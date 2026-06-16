import { supabase, supabaseConfigReady } from './supabaseClient.js';
import { clearCachedUserProfile, getCurrentUserProfile } from './userProfileService.js';

function requireSupabase() {
  if (!supabaseConfigReady || !supabase) {
    throw new Error('Supabase is not configured. Check client/.env and restart Vite.');
  }

  return supabase;
}

function getAuthRedirectUrl() {
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();
}

function isExistingAccountError(error) {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('already registered')
    || message.includes('already been registered')
    || message.includes('already exists')
    || message.includes('identity')
    || message.includes('user already');
}

function getExistingAccountMessage(email) {
  return `An account already exists for ${email}. Please log in instead, or use Continue with Google if you created it with Google.`;
}

export async function registerUser(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl()
    }
  });

  if (error) {
    if (isExistingAccountError(error)) {
      throw new Error(getExistingAccountMessage(email));
    }

    throw error;
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error(getExistingAccountMessage(email));
  }

  if (data.session?.user) {
    await getCurrentUserProfile();
  }

  return data;
}

export async function loginUser(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  await getCurrentUserProfile();

  return data;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl()
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function logoutUser() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }

  clearCachedUserProfile();
}

export async function deleteCurrentAccount() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('delete-account', {
    method: 'POST'
  });

  if (error) {
    throw error;
  }

  await client.auth.signOut().catch(() => {});

  clearCachedUserProfile();
  return data;
}

export async function getCurrentUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    if (error.message?.toLowerCase().includes('auth session missing')) {
      return null;
    }

    throw error;
  }

  return data.user;
}

export async function sendPasswordReset(email) {
  const client = requireSupabase();
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl()
  });

  if (error) {
    throw error;
  }

  return data;
}
