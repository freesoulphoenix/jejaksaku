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

export async function getAccounts() {
  const { client, userProfileId } = await getScopedQuery();
  const { data, error } = await client
    .from('accounts')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function createAccount(account) {
  const { client, userProfileId } = await getScopedQuery();
  const balance = Number(account.balance || 0);
  const { data, error } = await client
    .from('accounts')
    .insert({
      user_profile_id: userProfileId,
      name: account.name,
      type: account.type,
      balance,
      opening_balance: balance,
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
