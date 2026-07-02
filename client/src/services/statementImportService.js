import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';
import { resolveMoneyDirection } from '../utils/transactionDirection.js';

const STATEMENT_BUCKET = 'statements';
const IMPORTED_TRANSACTION_BATCH_SIZE = 200;

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function getScopedClient() {
  const userProfileId = await getCurrentUserProfileId();
  return {
    client: requireSupabase(),
    userProfileId
  };
}

function getFileExtension(file) {
  return file.name.split('.').pop()?.toLowerCase() || 'file';
}

function normalizeFileName(fileName) {
  return String(fileName || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getStatementStoragePath(statementImport) {
  if (statementImport.file_storage_path) {
    return statementImport.file_storage_path;
  }

  const marker = '/storage/v1/object/public/statements/';
  const fileUrl = String(statementImport.file_url || '');
  const markerIndex = fileUrl.indexOf(marker);

  if (markerIndex === -1) {
    return '';
  }

  return decodeURIComponent(fileUrl.slice(markerIndex + marker.length).split('?')[0]);
}

async function getFileHash(file) {
  if (!file?.arrayBuffer || !crypto.subtle) {
    return '';
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getStatementPath(userProfileId, file) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return `${userProfileId}/${id}.${getFileExtension(file)}`;
}

async function uploadStatementFile(client, userProfileId, file) {
  const path = getStatementPath(userProfileId, file);
  const { error } = await client.storage
    .from(STATEMENT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(STATEMENT_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl
  };
}

export async function getStatementImports() {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('statement_imports')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .is('file_deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function findDuplicateStatementImport(file, bankName = '') {
  const { client, userProfileId } = await getScopedClient();
  const fileHash = await getFileHash(file);
  const normalizedName = normalizeFileName(file.name);
  const fileSize = Number(file.size || 0);
  const normalizedBankName = bankName || null;

  if (fileHash) {
    const { data, error } = await client
      .from('statement_imports')
      .select('*')
      .eq('user_profile_id', userProfileId)
      .eq('file_hash', fileHash)
      .is('file_deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.[0]) {
      return { existing: data[0], fileHash };
    }
  }

  let fingerprintQuery = client
    .from('statement_imports')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .eq('file_size', fileSize)
    .is('file_deleted_at', null)
    .order('created_at', { ascending: false });

  fingerprintQuery = normalizedBankName
    ? fingerprintQuery.eq('bank_name', normalizedBankName)
    : fingerprintQuery.is('bank_name', null);

  const { data, error } = await fingerprintQuery;

  if (error) {
    throw error;
  }

  const existing = (data || []).find((item) => normalizeFileName(item.file_name) === normalizedName);
  return existing ? { existing, fileHash } : { existing: null, fileHash };
}

export async function createStatementImport(file, bankName = '', options = {}) {
  const { client, userProfileId } = await getScopedClient();

  if (!file) {
    throw new Error('Choose a statement file first.');
  }

  const fileHash = options.fileHash || await getFileHash(file);
  const uploadedFile = await uploadStatementFile(client, userProfileId, file);
  const { data, error } = await client
    .from('statement_imports')
    .insert({
      user_profile_id: userProfileId,
      bank_name: bankName || null,
      file_name: file.name,
      file_type: getFileExtension(file),
      file_size: Number(file.size || 0),
      file_hash: fileHash || null,
      file_url: uploadedFile.publicUrl,
      file_storage_path: uploadedFile.path,
      import_status: 'uploaded'
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteStatementImportFile(statementImport) {
  const { client, userProfileId } = await getScopedClient();

  if (!statementImport?.id) {
    throw new Error('Choose an uploaded statement first.');
  }

  const storagePath = getStatementStoragePath(statementImport);

  if (statementImport.file_url && !storagePath) {
    throw new Error('Unable to locate the uploaded statement file.');
  }

  if (storagePath) {
    const { error: storageError } = await client.storage
      .from(STATEMENT_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await client
    .from('statement_imports')
    .delete()
    .eq('id', statementImport.id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }

  return statementImport.id;
}

export async function updateStatementImportStatus(id, importStatus) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('statement_imports')
    .update({ import_status: importStatus })
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getImportedTransactions(statementImportId) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('imported_transactions')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .eq('statement_import_id', statementImportId)
    .order('transaction_date', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

function normalizeImportedRow(row, userProfileId, statementImportId) {
  const cleanDescription = row.clean_description || row.description || row.raw_description || 'Imported transaction';
  const rawDescription = row.raw_description || row.description || cleanDescription;
  const amount = Number(row.amount || 0);
  const transactionType = row.transaction_type || (amount < 0 ? 'expense' : 'income');

  return {
    user_profile_id: userProfileId,
    statement_import_id: statementImportId,
    source_row_number: row.source_row_number ? Number(row.source_row_number) : null,
    transaction_date: row.transaction_date,
    description: cleanDescription,
    raw_description: rawDescription,
    clean_description: cleanDescription,
    amount,
    money_direction: resolveMoneyDirection({
      amount,
      money_direction: row.money_direction,
      transaction_type: transactionType
    }),
    transaction_type: transactionType,
    account_id: row.account_id || null,
    from_account_id: row.from_account_id || null,
    to_account_id: row.to_account_id || null,
    category_id: row.category_id || null,
    project_tag_id: row.project_tag_id || null,
    transfer_purpose: row.transfer_purpose || null,
    transfer_fee: Number(row.transfer_fee || 0),
    notes: row.notes || null,
    import_status: row.import_status || 'pending'
  };
}

export async function saveImportedTransactions(statementImportId, rows) {
  const { client, userProfileId } = await getScopedClient();

  if (rows.length === 0) {
    return [];
  }

  const payload = rows.map((row) => normalizeImportedRow(row, userProfileId, statementImportId));
  const savedRows = [];

  for (let index = 0; index < payload.length; index += IMPORTED_TRANSACTION_BATCH_SIZE) {
    const batch = payload.slice(index, index + IMPORTED_TRANSACTION_BATCH_SIZE);
    const { data, error } = await client
      .from('imported_transactions')
      .upsert(batch, {
        onConflict: 'statement_import_id,source_row_number',
        ignoreDuplicates: true
      })
      .select('*');

    if (error) {
      throw error;
    }

    savedRows.push(...(data || []));
  }

  await updateStatementImportStatus(statementImportId, 'pending');
  return savedRows;
}

export async function updateImportedTransactionStatus(id, importStatus, createdTransactionId = null) {
  const { client, userProfileId } = await getScopedClient();
  const payload = {
    import_status: importStatus
  };

  if (createdTransactionId) {
    payload.created_transaction_id = createdTransactionId;
  }

  const { data, error } = await client
    .from('imported_transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (createdTransactionId) {
    const { error: transactionLinkError } = await client
      .from('transactions')
      .update({ imported_transaction_id: id })
      .eq('id', createdTransactionId)
      .eq('user_profile_id', userProfileId)
      .is('imported_transaction_id', null);

    if (transactionLinkError) {
      throw transactionLinkError;
    }
  }

  return data;
}

export async function updateImportedTransaction(id, row) {
  const { client, userProfileId } = await getScopedClient();
  const amount = Number(row.amount || 0);
  const payload = {
    clean_description: row.clean_description || row.description || 'Imported transaction',
    description: row.clean_description || row.description || 'Imported transaction',
    raw_description: row.raw_description || null,
    amount,
    transaction_date: row.transaction_date,
    transaction_type: row.transaction_type,
    account_id: row.account_id || null,
    from_account_id: row.from_account_id || null,
    to_account_id: row.to_account_id || null,
    category_id: row.transaction_type === 'transfer' ? null : row.category_id || null,
    project_tag_id: row.project_tag_id || null,
    transfer_purpose: row.transfer_purpose || null,
    transfer_fee: Number(row.transfer_fee || 0),
    money_direction: resolveMoneyDirection({
      amount,
      money_direction: row.money_direction,
      transaction_type: row.transaction_type
    }),
    notes: row.notes || null,
    import_status: row.import_status || 'pending'
  };
  const { data, error } = await client
    .from('imported_transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function bulkUpdateImportedTransactions(ids, fields) {
  const { client, userProfileId } = await getScopedClient();

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('imported_transactions')
    .update(fields)
    .eq('user_profile_id', userProfileId)
    .in('id', ids)
    .select('*');

  if (error) {
    throw error;
  }

  return data;
}
