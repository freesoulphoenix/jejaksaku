import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';
import { createTransaction } from './transactionService.js';

const RECEIPT_BUCKET = 'receipts';

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
  return file.name.split('.').pop() || 'jpg';
}

function createReceiptPath(userProfileId, file) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return `${userProfileId}/${id}.${getFileExtension(file)}`;
}

function getStoragePathFromUrl(url) {
  if (!url) {
    return '';
  }

  const marker = `/storage/v1/object/public/${RECEIPT_BUCKET}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return '';
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
}

async function uploadReceiptFile(client, userProfileId, file) {
  const path = createReceiptPath(userProfileId, file);
  const { error } = await client.storage
    .from(RECEIPT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(RECEIPT_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl
  };
}

function normalizeReceipt(receipt, userProfileId, uploadedFile) {
  return {
    user_profile_id: userProfileId,
    image_url: uploadedFile.publicUrl,
    file_storage_path: uploadedFile.path,
    merchant_name: receipt.merchant_name || null,
    receipt_date: receipt.receipt_date || null,
    total_amount: Number(receipt.total_amount || 0),
    processing_status: receipt.processing_status || 'pending'
  };
}

export async function getReceipts() {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('receipts')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('receipt_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getReceipt(id) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('receipts')
    .select(`
      *,
      receipt_items (*)
    `)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (error) {
    throw error;
  }

  const { data: transaction, error: transactionError } = await client
    .from('transactions')
    .select(`
      *,
      accounts:account_id (id, name, type),
      categories:category_id (id, name, type),
      project_tags:project_tag_id (id, name)
    `)
    .eq('user_profile_id', userProfileId)
    .eq('receipt_id', id)
    .maybeSingle();

  if (transactionError) {
    throw transactionError;
  }

  return {
    ...data,
    linked_transaction: transaction
  };
}

export async function createReceipt(receipt) {
  const { client, userProfileId } = await getScopedClient();

  if (!receipt.file) {
    throw new Error('Choose a receipt file first.');
  }

  const uploadedFile = await uploadReceiptFile(client, userProfileId, receipt.file);
  const { data, error } = await client
    .from('receipts')
    .insert(normalizeReceipt(receipt, userProfileId, uploadedFile))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateReceiptStatus(id, processingStatus) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('receipts')
    .update({ processing_status: processingStatus })
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateReceiptReview(id, receipt) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('receipts')
    .update({
      merchant_name: receipt.merchant_name || null,
      receipt_date: receipt.receipt_date || null,
      total_amount: Number(receipt.total_amount || 0),
      processing_status: receipt.processing_status || 'completed'
    })
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createTransactionFromReceipt(receiptId, transaction) {
  const { client, userProfileId } = await getScopedClient();
  const { data: receipt, error: receiptError } = await client
    .from('receipts')
    .select('*')
    .eq('id', receiptId)
    .eq('user_profile_id', userProfileId)
    .single();

  if (receiptError) {
    throw receiptError;
  }

  const { data: existingTransaction, error: existingError } = await client
    .from('transactions')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .eq('receipt_id', receiptId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingTransaction) {
    throw new Error('This receipt already has a transaction.');
  }

  return createTransaction({
    account_id: transaction.account_id || null,
    category_id: transaction.category_id || null,
    project_tag_id: transaction.project_tag_id || null,
    receipt_id: receiptId,
    transaction_type: 'expense',
    amount: Number(receipt.total_amount || 0),
    description: receipt.merchant_name || 'Receipt transaction',
    transaction_date: receipt.receipt_date || new Date().toISOString().slice(0, 10),
    notes: 'Created from receipt'
  });
}

export async function deleteReceipt(id) {
  const { client, userProfileId } = await getScopedClient();
  const { data: receipt, error: fetchError } = await client
    .from('receipts')
    .select('image_url, file_storage_path')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const { error } = await client
    .from('receipts')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }

  const storagePath = receipt.file_storage_path || getStoragePathFromUrl(receipt.image_url);

  if (storagePath) {
    await client.storage.from(RECEIPT_BUCKET).remove([storagePath]);
  }
}
