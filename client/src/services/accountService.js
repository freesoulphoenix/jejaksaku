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

async function getNextAccountSortOrder({ client, type, userProfileId }) {
  const { data, error } = await client
    .from('accounts')
    .select('sort_order')
    .eq('user_profile_id', userProfileId)
    .eq('type', type)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const currentMax = Number(data?.[0]?.sort_order);
  return Number.isFinite(currentMax) ? currentMax + 1 : 1;
}

export async function getAccounts() {
  const { client, userProfileId } = await getScopedQuery();

  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function createAccount(account) {
  const { client, userProfileId } = await getScopedQuery();
  const balance = Number(account.balance || 0);
  const sortOrder = await getNextAccountSortOrder({
    client,
    type: account.type,
    userProfileId
  });

  const { data, error } = await client
    .from('accounts')
    .insert({
      user_profile_id: userProfileId,
      name: account.name,
      type: account.type,
      balance,
      opening_balance: balance,
      sort_order: sortOrder,
      status: account.status || 'active'
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateAccount(id, account) {
  const { client, userProfileId } = await getScopedQuery();

  const { data: existing, error: existingError } = await client
    .from('accounts')
    .select('*')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (existingError) {
    throw existingError;
  }

  const nextBalance = Number(account.balance || 0);
  const balanceChanged = Number(existing.balance || 0) !== nextBalance;

  const { data, error } = await client
    .from('accounts')
    .update({
      name: account.name,
      type: account.type,
      balance: nextBalance,
      opening_balance: Number(account.opening_balance ?? existing.opening_balance ?? 0),
      status: account.status || 'active',
      last_reconciled_at: balanceChanged ? new Date().toISOString() : existing.last_reconciled_at
    })
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (balanceChanged) {
    const calculatedBalance = Number(account.calculated_balance ?? existing.balance ?? 0);

    const { error: reconciliationError } = await client
      .from('account_reconciliations')
      .insert({
        user_profile_id: userProfileId,
        account_id: id,
        calculated_balance: calculatedBalance,
        reconciled_balance: nextBalance,
        difference: nextBalance - calculatedBalance,
        notes: account.reconciliation_notes || null
      });

    if (reconciliationError) {
      throw reconciliationError;
    }
  }

  return data;
}

export async function updateAccountOrder(accounts = []) {
  const { client, userProfileId } = await getScopedQuery();

  const updates = accounts.map((account, index) =>
    client
      .from('accounts')
      .update({ sort_order: index + 1 })
      .eq('id', account.id)
      .eq('user_profile_id', userProfileId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw failed.error;
  }
}

export async function deleteAccount(id) {
  const { client, userProfileId } = await getScopedQuery();

  const { error } = await client
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }
}
