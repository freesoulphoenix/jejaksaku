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

export async function registerUser(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password
  });

  if (error) {
    throw error;
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
