import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';

const STATEMENT_BUCKET = 'statements';

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

  if (statementImport.file_storage_path) {
    const { error: storageError } = await client.storage
      .from(STATEMENT_BUCKET)
      .remove([statementImport.file_storage_path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { data, error } = await client
    .from('statement_imports')
    .update({
      file_deleted_at: new Date().toISOString(),
      file_url: null
    })
    .eq('id', statementImport.id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
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

  return {
    user_profile_id: userProfileId,
    statement_import_id: statementImportId,
    transaction_date: row.transaction_date,
    description: cleanDescription,
    raw_description: rawDescription,
    clean_description: cleanDescription,
    amount,
    money_direction: row.money_direction || (amount < 0 ? 'out' : amount > 0 ? 'in' : null),
    transaction_type: row.transaction_type || (amount < 0 ? 'expense' : 'income'),
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

  const { data, error } = await client
    .from('imported_transactions')
    .upsert(payload, {
      onConflict: 'statement_import_id,transaction_date,description,amount',
      ignoreDuplicates: true
    })
    .select('*');

  if (error) {
    throw error;
  }

  await updateStatementImportStatus(statementImportId, 'pending');
  return data;
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

  return data;
}

export async function updateImportedTransaction(id, row) {
  const { client, userProfileId } = await getScopedClient();
  const payload = {
    clean_description: row.clean_description || row.description || 'Imported transaction',
    description: row.clean_description || row.description || 'Imported transaction',
    raw_description: row.raw_description || null,
    amount: Number(row.amount || 0),
    transaction_date: row.transaction_date,
    transaction_type: row.transaction_type,
    account_id: row.account_id || null,
    from_account_id: row.from_account_id || null,
    to_account_id: row.to_account_id || null,
    category_id: row.transaction_type === 'transfer' ? null : row.category_id || null,
    project_tag_id: row.project_tag_id || null,
    transfer_purpose: row.transfer_purpose || null,
    transfer_fee: Number(row.transfer_fee || 0),
    money_direction: row.money_direction || null,
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
