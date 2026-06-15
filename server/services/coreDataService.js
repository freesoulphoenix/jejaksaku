import { requireSupabase } from '../config/supabase.js';

const tableConfig = {
  accounts: {
    orderBy: 'created_at'
  },
  categories: {
    orderBy: 'name'
  },
  project_tags: {
    orderBy: 'name'
  },
  transactions: {
    orderBy: 'transaction_date',
    ascending: false
  },
  upcoming_due: {
    orderBy: 'due_date'
  }
};

function applyUserScope(query, userId) {
  return userId ? query.eq('user_id', userId) : query.is('user_id', null);
}

function getConfig(tableName) {
  return tableConfig[tableName] || { orderBy: 'created_at' };
}

function getClient() {
  return requireSupabase();
}

export async function listRows(tableName, userId) {
  const config = getConfig(tableName);
  let query = getClient().from(tableName).select('*');

  query = applyUserScope(query, userId);
  query = query.order(config.orderBy, { ascending: config.ascending ?? true });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

export async function createRow(tableName, userId, payload) {
  const row = {
    ...payload,
    user_id: userId || null
  };

  const { data, error } = await getClient()
    .from(tableName)
    .insert(row)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRow(tableName, userId, id, payload) {
  let query = getClient()
    .from(tableName)
    .update(payload)
    .eq('id', id);

  query = applyUserScope(query, userId);

  const { data, error } = await query.select('*').single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteRow(tableName, userId, id) {
  let query = getClient()
    .from(tableName)
    .delete()
    .eq('id', id);

  query = applyUserScope(query, userId);

  const { error } = await query;

  if (error) {
    throw error;
  }
}
