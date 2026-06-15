import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';

export async function getCategories() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const userProfileId = await getCurrentUserProfileId();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}
