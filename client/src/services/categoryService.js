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

export async function createCategory({ name, type = 'expense', parent_category_id = null }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const userProfileId = await getCurrentUserProfileId();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_profile_id: userProfileId,
      name: name.trim(),
      type,
      parent_category_id: parent_category_id || null
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCategory(id, { name, type = 'expense', parent_category_id = null }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('categories')
    .update({
      name: name.trim(),
      type,
      parent_category_id: parent_category_id || null
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCategory(id) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}
