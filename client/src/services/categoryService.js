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
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function getNextCategorySortOrder({ parentCategoryId, type, userProfileId }) {
  let query = supabase
    .from('categories')
    .select('sort_order')
    .eq('user_profile_id', userProfileId)
    .eq('type', type)
    .order('sort_order', { ascending: false, nullsFirst: false })
    .limit(1);

  query = parentCategoryId
    ? query.eq('parent_category_id', parentCategoryId)
    : query.is('parent_category_id', null);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const currentMax = Number(data?.[0]?.sort_order);
  return Number.isFinite(currentMax) ? currentMax + 1 : 1;
}

export async function createCategory({ name, note = '', type = 'expense', parent_category_id = null }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const userProfileId = await getCurrentUserProfileId();
  const parentCategoryId = parent_category_id || null;
  const sortOrder = await getNextCategorySortOrder({
    parentCategoryId,
    type,
    userProfileId
  });

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_profile_id: userProfileId,
      name: name.trim(),
      note: note.trim() || null,
      type,
      parent_category_id: parentCategoryId,
      sort_order: sortOrder
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCategoryOrder(categories = []) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const updates = categories.map((category, index) => (
    supabase
      .from('categories')
      .update({ sort_order: index + 1 })
      .eq('id', category.id)
  ));

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw failed.error;
  }
}

export async function updateCategory(id, { name, note = '', type = 'expense', parent_category_id = null }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('categories')
    .update({
      name: name.trim(),
      note: note.trim() || null,
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
