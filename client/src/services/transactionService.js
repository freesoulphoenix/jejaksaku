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

function normalizeTransaction(transaction, userProfileId) {
  const transactionType = transaction.transaction_type;
  const amount = Math.abs(Number(transaction.amount || 0));
  const fromAccountId = transaction.from_account_id || (transactionType === 'transfer' ? transaction.account_id : null) || null;
  const toAccountId = transaction.to_account_id || null;

  return {
    user_profile_id: userProfileId,
    account_id: transactionType === 'transfer' ? fromAccountId : transaction.account_id || null,
    from_account_id: transactionType === 'transfer' ? fromAccountId : null,
    to_account_id: transactionType === 'transfer' ? toAccountId : null,
    category_id: transactionType === 'transfer' ? null : transaction.category_id || null,
    project_tag_id: transaction.project_tag_id || null,
    receipt_id: transaction.receipt_id || null,
    imported_transaction_id: transaction.imported_transaction_id || null,
    transaction_type: transactionType,
    amount,
    description: transaction.description || null,
    transaction_date: transaction.transaction_date,
    notes: transaction.notes || null,
    transfer_purpose: transaction.transfer_purpose || null,
    transfer_fee: transactionType === 'transfer' ? Number(transaction.transfer_fee || 0) : 0,
    money_direction: transaction.money_direction || null,
    financial_activity: transaction.financial_activity || 'standard'
  };
}

function validateTransaction(transaction) {
  if (!transaction.transaction_type) {
    throw new Error('Transaction type is required.');
  }

  if (!Number(transaction.amount || 0)) {
    throw new Error('Amount is required.');
  }

  if (transaction.transaction_type === 'transfer') {
    if (!transaction.from_account_id || !transaction.to_account_id) {
      throw new Error('Transfer requires both From Account and To Account.');
    }

    if (transaction.from_account_id === transaction.to_account_id) {
      throw new Error('From Account and To Account must be different.');
    }

    return;
  }

  if (!transaction.account_id) {
    throw new Error('Account is required.');
  }

  if (!transaction.category_id) {
    throw new Error('Category is required.');
  }
}

function addDelta(deltas, accountId, amount) {
  if (!accountId || !amount) {
    return;
  }

  deltas.set(accountId, (deltas.get(accountId) || 0) + amount);
}

function getBalanceDeltas(transaction, multiplier = 1) {
  const deltas = new Map();
  const amount = Math.abs(Number(transaction.amount || 0));
  const fee = Math.abs(Number(transaction.transfer_fee || 0));

  if (transaction.transaction_type === 'income') {
    addDelta(deltas, transaction.account_id, amount * multiplier);
  } else if (transaction.transaction_type === 'expense') {
    addDelta(deltas, transaction.account_id, -amount * multiplier);
  } else if (transaction.transaction_type === 'transfer') {
    addDelta(deltas, transaction.from_account_id || transaction.account_id, -(amount + fee) * multiplier);
    addDelta(deltas, transaction.to_account_id, amount * multiplier);
  }

  return deltas;
}

function mergeDeltas(target, source) {
  source.forEach((value, key) => {
    target.set(key, (target.get(key) || 0) + value);
  });
}

async function applyAccountBalanceDeltas(client, userProfileId, deltas) {
  const accountIds = [...deltas.keys()].filter((accountId) => deltas.get(accountId));

  if (accountIds.length === 0) {
    return;
  }

  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, balance')
    .eq('user_profile_id', userProfileId)
    .in('id', accountIds);

  if (error) {
    throw error;
  }

  const updates = accounts.map((account) => (
    client
      .from('accounts')
      .update({ balance: Number(account.balance || 0) + deltas.get(account.id) })
      .eq('id', account.id)
      .eq('user_profile_id', userProfileId)
  ));

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    throw failed.error;
  }
}

export async function getTransactions() {
  const { client, userProfileId } = await getScopedQuery();
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from('transactions')
      .select(`
        *,
        accounts:account_id (id, name, type),
        from_account:from_account_id (id, name, type),
        to_account:to_account_id (id, name, type),
        categories:category_id (id, name, type),
        project_tags:project_tag_id (id, name),
        receipt:receipt_id (id, merchant_name, receipt_date),
        imported_transaction:imported_transaction_id (
          id,
          import_status,
          transaction_date,
          statement_import:statement_import_id (id, file_name, bank_name)
        )
      `)
      .eq('user_profile_id', userProfileId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

export async function unlinkTransactionFromStatement(id) {
  const { client, userProfileId } = await getScopedQuery();
  const { data: transaction, error: transactionError } = await client
    .from('transactions')
    .select('id, imported_transaction_id')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (transactionError) {
    throw transactionError;
  }

  if (!transaction.imported_transaction_id) {
    throw new Error('This transaction is not linked to a statement entry.');
  }

  const { data: importedRow, error: importedRowError } = await client
    .from('imported_transactions')
    .select('id, import_status')
    .eq('id', transaction.imported_transaction_id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (importedRowError) {
    throw importedRowError;
  }

  if (importedRow.import_status !== 'duplicate') {
    throw new Error('Imported statement transactions cannot be unlinked.');
  }

  const { error: unlinkError } = await client
    .from('transactions')
    .update({ imported_transaction_id: null })
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (unlinkError) {
    throw unlinkError;
  }

  const { error: restoreRowError } = await client
    .from('imported_transactions')
    .update({
      created_transaction_id: null,
      import_status: 'pending'
    })
    .eq('id', importedRow.id)
    .eq('user_profile_id', userProfileId);

  if (restoreRowError) {
    await client
      .from('transactions')
      .update({ imported_transaction_id: importedRow.id })
      .eq('id', id)
      .eq('user_profile_id', userProfileId);
    throw restoreRowError;
  }
}

export async function createTransaction(transaction) {
  const { client, userProfileId } = await getScopedQuery();
  const payload = normalizeTransaction(transaction, userProfileId);
  validateTransaction(payload);

  const { data, error } = await client
    .from('transactions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await applyAccountBalanceDeltas(client, userProfileId, getBalanceDeltas(data));
  return data;
}

export async function updateTransaction(id, transaction) {
  const { client, userProfileId } = await getScopedQuery();
  const { user_profile_id, ...payload } = normalizeTransaction(transaction, userProfileId);
  validateTransaction(payload);

  const { data: existing, error: existingError } = await client
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (existingError) {
    throw existingError;
  }

  const { data, error } = await client
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const deltas = new Map();
  mergeDeltas(deltas, getBalanceDeltas(existing, -1));
  mergeDeltas(deltas, getBalanceDeltas(data));
  await applyAccountBalanceDeltas(client, userProfileId, deltas);
  return data;
}

export async function deleteTransaction(id) {
  const { client, userProfileId } = await getScopedQuery();
  const { data: existing, error: existingError } = await client
    .from('transactions')
    .select('*')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (existingError) {
    throw existingError;
  }

  const { error } = await client
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }

  await applyAccountBalanceDeltas(client, userProfileId, getBalanceDeltas(existing, -1));
}

export async function updateTransactions(transactions = [], changes = {}) {
  const category = changes.category_id
    ? await (async () => {
      const { client, userProfileId } = await getScopedQuery();
      const { data, error } = await client
        .from('categories')
        .select('id, type')
        .eq('id', changes.category_id)
        .eq('user_profile_id', userProfileId)
        .single();

      if (error) throw error;
      return data;
    })()
    : null;

  const nextTransactions = transactions.map((transaction) => {
    const isTransfer = transaction.transaction_type === 'transfer';
    const nextTransaction = {
      ...transaction,
      ...(Object.hasOwn(changes, 'project_tag_id')
        ? { project_tag_id: changes.project_tag_id }
        : {}),
      ...(Object.hasOwn(changes, 'category_id') && !isTransfer
        ? { category_id: changes.category_id }
        : {})
    };

    if (Object.hasOwn(changes, 'account_id')) {
      if (isTransfer) {
        nextTransaction.from_account_id = changes.account_id;
        nextTransaction.account_id = changes.account_id;
      } else {
        nextTransaction.account_id = changes.account_id;
      }
    }

    if (category && !isTransfer && category.type !== transaction.transaction_type) {
      throw new Error('The selected category must match the type of every selected expense or income activity.');
    }

    validateTransaction(normalizeTransaction(nextTransaction, transaction.user_profile_id));
    return nextTransaction;
  });

  for (const transaction of nextTransactions) {
    await updateTransaction(transaction.id, transaction);
  }
}

export async function deleteTransactions(ids = []) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);

  if (uniqueIds.length === 0) {
    return;
  }

  const { client, userProfileId } = await getScopedQuery();
  const { data: existing, error: existingError } = await client
    .from('transactions')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .in('id', uniqueIds);

  if (existingError) {
    throw existingError;
  }

  if ((existing || []).length !== uniqueIds.length) {
    throw new Error('One or more selected activities no longer exist. Refresh and try again.');
  }

  const { error } = await client
    .from('transactions')
    .delete()
    .eq('user_profile_id', userProfileId)
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  const deltas = new Map();
  existing.forEach((transaction) => {
    mergeDeltas(deltas, getBalanceDeltas(transaction, -1));
  });
  await applyAccountBalanceDeltas(client, userProfileId, deltas);
}
