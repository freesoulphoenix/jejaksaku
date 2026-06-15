import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

async function getScopedQuery() {
  const userProfileId = await getCurrentUserProfileId();
  return {
    client: requireSupabase(),
    userProfileId
  };
}

function normalizeTransaction(transaction, userProfileId) {
  return {
    user_profile_id: userProfileId,
    account_id: transaction.account_id || null,
    category_id: transaction.category_id || null,
    project_tag_id: transaction.project_tag_id || null,
    receipt_id: transaction.receipt_id || null,
    imported_transaction_id: transaction.imported_transaction_id || null,
    transaction_type: transaction.transaction_type,
    amount: Number(transaction.amount || 0),
    description: transaction.description || null,
    transaction_date: transaction.transaction_date,
    notes: transaction.notes || null
  };
}

export async function getTransactions() {
  const { client, userProfileId } = await getScopedQuery();
  const { data, error } = await client
    .from('transactions')
    .select(`
      *,
      accounts:account_id (id, name, type),
      categories:category_id (id, name, type),
      project_tags:project_tag_id (id, name)
    `)
    .eq('user_profile_id', userProfileId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createTransaction(transaction) {
  const { client, userProfileId } = await getScopedQuery();
  const { data, error } = await client
    .from('transactions')
    .insert(normalizeTransaction(transaction, userProfileId))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTransaction(id, transaction) {
  const { client, userProfileId } = await getScopedQuery();
  const { user_profile_id, ...payload } = normalizeTransaction(transaction, userProfileId);
  const { data, error } = await client
    .from('transactions')
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

export async function deleteTransaction(id) {
  const { client, userProfileId } = await getScopedQuery();
  const { error } = await client
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }
}
