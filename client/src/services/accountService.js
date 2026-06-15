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
  const { data, error } = await client
    .from('accounts')
    .insert({
      user_profile_id: userProfileId,
      name: account.name,
      type: account.type,
      balance: Number(account.balance || 0),
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
  const { data, error } = await client
    .from('accounts')
    .update({
      name: account.name,
      type: account.type,
      balance: Number(account.balance || 0),
      status: account.status || 'active'
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
