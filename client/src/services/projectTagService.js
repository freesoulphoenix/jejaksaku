import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';

export async function getProjectTags() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const userProfileId = await getCurrentUserProfileId();
  const { data, error } = await supabase
    .from('project_tags')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}
