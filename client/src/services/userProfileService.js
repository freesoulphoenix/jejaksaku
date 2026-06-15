import { supabase, supabaseConfigReady } from './supabaseClient.js';

const defaultAccounts = [
  ['BCA', 'Bank'],
  ['BRI', 'Bank'],
  ['Mandiri', 'Bank'],
  ['BNI', 'Bank'],
  ['Jago', 'Bank'],
  ['GoPay', 'E-Wallet'],
  ['OVO', 'E-Wallet'],
  ['ShopeePay', 'E-Wallet'],
  ['DANA', 'E-Wallet'],
  ['LinkAja', 'E-Wallet']
];

const defaultCategories = [
  'Food & Drink',
  'Groceries',
  'Transport',
  'Bills & Utilities',
  'Apartment',
  'Subscription',
  'Shopping',
  'Health',
  'Personal Care',
  'Entertainment',
  'Travel',
  'Education',
  'Music Project',
  'Business',
  'Other'
];

const defaultProjectTags = [
  'Daily Life',
  'Apartment',
  'Music',
  'Business',
  'Travel',
  'Running',
  'Family',
  'Other'
];

let cachedProfile = null;

function requireSupabase() {
  if (!supabaseConfigReady || !supabase) {
    throw new Error('Supabase is not configured. Check client/.env and restart Vite.');
  }

  return supabase;
}

async function getAuthenticatedUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You must be logged in to use Dompet Daily.');
  }

  return data.user;
}

async function seedUserDefaults(client, userProfileId) {
  const { data: existingAccounts, error: accountCheckError } = await client
    .from('accounts')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .limit(1);

  if (accountCheckError) {
    throw accountCheckError;
  }

  if (!existingAccounts?.length) {
    const { error } = await client
      .from('accounts')
      .upsert(defaultAccounts.map(([name, type]) => ({
        user_profile_id: userProfileId,
        name,
        type
      })), {
        ignoreDuplicates: true,
        onConflict: 'user_profile_id,name'
      });

    if (error) {
      throw error;
    }
  }

  const { data: existingCategories, error: categoryCheckError } = await client
    .from('categories')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .limit(1);

  if (categoryCheckError) {
    throw categoryCheckError;
  }

  if (!existingCategories?.length) {
    const { error } = await client
      .from('categories')
      .upsert(defaultCategories.map((name) => ({
        user_profile_id: userProfileId,
        name,
        type: 'expense'
      })), {
        ignoreDuplicates: true,
        onConflict: 'user_profile_id,name,type'
      });

    if (error) {
      throw error;
    }
  }

  const { data: existingProjectTags, error: projectTagCheckError } = await client
    .from('project_tags')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .limit(1);

  if (projectTagCheckError) {
    throw projectTagCheckError;
  }

  if (!existingProjectTags?.length) {
    const { error } = await client
      .from('project_tags')
      .upsert(defaultProjectTags.map((name) => ({
        user_profile_id: userProfileId,
        name
      })), {
        ignoreDuplicates: true,
        onConflict: 'user_profile_id,name'
      });

    if (error) {
      throw error;
    }
  }
}

export function clearCachedUserProfile() {
  cachedProfile = null;
}

export async function getCurrentUserProfile() {
  const client = requireSupabase();
  const user = await getAuthenticatedUser();

  if (cachedProfile?.auth_user_id === user.id) {
    return cachedProfile;
  }

  const { data: existingProfile, error: existingError } = await client
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingProfile) {
    cachedProfile = existingProfile;
    await seedUserDefaults(client, existingProfile.id);
    return existingProfile;
  }

  const { data: createdProfile, error: createError } = await client
    .from('user_profiles')
    .insert({
      auth_user_id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Dompet Daily User',
      email: user.email
    })
    .select('*')
    .single();

  if (createError) {
    throw createError;
  }

  cachedProfile = createdProfile;
  await seedUserDefaults(client, createdProfile.id);
  return createdProfile;
}

export async function getCurrentUserProfileId() {
  const profile = await getCurrentUserProfile();
  return profile.id;
}
