import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';
import { createTransaction, updateTransaction } from './transactionService.js';

const RECEIPT_BUCKET = 'receipts';
const IMMUTABLE_CACHE_SECONDS = '31536000';
const THUMBNAIL_MAX_EDGE = 320;
const THUMBNAIL_QUALITY = 0.68;

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
  return file.name.split('.').pop()?.toLowerCase() || 'jpg';
}

function createReceiptPaths(userProfileId, file) {
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return {
    original: `${userProfileId}/${id}.${getFileExtension(file)}`,
    thumbnail: `${userProfileId}/${id}.thumb.webp`
  };
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

async function createReceiptThumbnail(file) {
  if (typeof document === 'undefined' || isPdfFile(file)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to create a receipt thumbnail.'));
      nextImage.src = objectUrl;
    });
    const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode a receipt thumbnail.'))),
        'image/webp',
        THUMBNAIL_QUALITY
      );
    });
  } catch (error) {
    // Unsupported image formats still retain their original file for the detail view.
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const paths = createReceiptPaths(userProfileId, file);
  const thumbnail = await createReceiptThumbnail(file);
  const { error } = await client.storage
    .from(RECEIPT_BUCKET)
    .upload(paths.original, file, {
      cacheControl: IMMUTABLE_CACHE_SECONDS,
      contentType: file.type || 'image/jpeg',
      upsert: false
    });

  if (error) {
    throw error;
  }

  let thumbnailUrl = null;

  if (thumbnail) {
    const { error: thumbnailError } = await client.storage
      .from(RECEIPT_BUCKET)
      .upload(paths.thumbnail, thumbnail, {
        cacheControl: IMMUTABLE_CACHE_SECONDS,
        contentType: 'image/webp',
        upsert: false
      });

    if (thumbnailError) {
      await client.storage.from(RECEIPT_BUCKET).remove([paths.original]);
      throw thumbnailError;
    }

    thumbnailUrl = client.storage.from(RECEIPT_BUCKET).getPublicUrl(paths.thumbnail).data.publicUrl;
  }

  const { data } = client.storage.from(RECEIPT_BUCKET).getPublicUrl(paths.original);
  return {
    path: paths.original,
    publicUrl: data.publicUrl,
    thumbnailPath: thumbnail ? paths.thumbnail : null,
    thumbnailUrl
  };
}

function normalizeReceipt(receipt, userProfileId, uploadedFile) {
  return {
    user_profile_id: userProfileId,
    image_url: uploadedFile.publicUrl,
    file_storage_path: uploadedFile.path,
    thumbnail_url: uploadedFile.thumbnailUrl,
    thumbnail_storage_path: uploadedFile.thumbnailPath,
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
    const uploadedPaths = [uploadedFile.path, uploadedFile.thumbnailPath].filter(Boolean);

    if (uploadedPaths.length > 0) {
      await client.storage.from(RECEIPT_BUCKET).remove(uploadedPaths);
    }

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

  const { data: linkedTransaction, error: linkedTransactionError } = await client
    .from('transactions')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .eq('receipt_id', id)
    .maybeSingle();

  if (linkedTransactionError) {
    throw linkedTransactionError;
  }

  if (linkedTransaction) {
    await updateTransaction(linkedTransaction.id, {
      ...linkedTransaction,
      amount: Number(data.total_amount || 0),
      description: data.merchant_name || linkedTransaction.description || 'Receipt transaction',
      transaction_date: data.receipt_date || linkedTransaction.transaction_date
    });
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

export async function linkReceiptToTransaction(receiptId, transactionId) {
  const { client, userProfileId } = await getScopedClient();
  const { data, error } = await client
    .from('transactions')
    .update({ receipt_id: receiptId })
    .eq('id', transactionId)
    .eq('user_profile_id', userProfileId)
    .is('receipt_id', null)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteReceipt(id) {
  const { client, userProfileId } = await getScopedClient();
  const { data: receipt, error: fetchError } = await client
    .from('receipts')
    .select('image_url, file_storage_path, thumbnail_url, thumbnail_storage_path')
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
  const thumbnailStoragePath = receipt.thumbnail_storage_path || getStoragePathFromUrl(receipt.thumbnail_url);
  const storagePaths = [storagePath, thumbnailStoragePath].filter(Boolean);

  if (storagePaths.length > 0) {
    await client.storage.from(RECEIPT_BUCKET).remove(storagePaths);
  }
}
