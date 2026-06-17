import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';
import { createTransaction } from './transactionService.js';

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

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function advanceDate(dateString, frequency) {
  const nextDate = new Date(`${dateString}T00:00:00`);

  if (frequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (frequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate.toISOString().slice(0, 10);
}

function getDerivedDueStatus(item) {
  if (item.paid_transaction_id) {
    return 'paid';
  }

  if (item.due_date < getTodayIsoDate()) {
    return 'overdue';
  }

  return 'upcoming';
}

function normalizeDueItem(item, userProfileId) {
  const payload = {
    user_profile_id: userProfileId,
    title: item.title,
    provider: item.provider || null,
    category_id: item.category_id || null,
    payment_account_id: item.payment_account_id || null,
    amount_due: Number(item.amount_due || 0),
    due_date: item.due_date,
    reminder_days_before: Number(item.reminder_days_before ?? 2),
    reminder_enabled: item.reminder_enabled ?? true,
    browser_notification_enabled: Boolean(item.browser_notification_enabled),
    email_notification_enabled: Boolean(item.email_notification_enabled),
    recurring_enabled: Boolean(item.recurring_enabled),
    recurring_frequency: item.recurring_enabled ? item.recurring_frequency || 'monthly' : null,
    notes: item.notes || null
  };

  return {
    ...payload,
    status: getDerivedDueStatus({
      ...item,
      ...payload
    })
  };
}

async function syncDerivedStatuses(client, userProfileId) {
  const today = getTodayIsoDate();
  const { error: paidError } = await client
    .from('upcoming_due')
    .update({ status: 'paid' })
    .eq('user_profile_id', userProfileId)
    .not('paid_transaction_id', 'is', null);

  if (paidError) {
    throw paidError;
  }

  const { error: overdueError } = await client
    .from('upcoming_due')
    .update({ status: 'overdue' })
    .eq('user_profile_id', userProfileId)
    .is('paid_transaction_id', null)
    .lt('due_date', today);

  if (overdueError) {
    throw overdueError;
  }

  const { error: upcomingError } = await client
    .from('upcoming_due')
    .update({ status: 'upcoming' })
    .eq('user_profile_id', userProfileId)
    .is('paid_transaction_id', null)
    .gte('due_date', today);

  if (upcomingError) {
    throw upcomingError;
  }
}

async function createNextRecurringDue(client, userProfileId, paidItem) {
  if (!paidItem.recurring_enabled) {
    return null;
  }

  const nextDueDate = advanceDate(paidItem.due_date, paidItem.recurring_frequency);
  const { data: existingNextDue, error: existingError } = await client
    .from('upcoming_due')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .eq('title', paidItem.title)
    .eq('amount_due', Number(paidItem.amount_due || 0))
    .eq('due_date', nextDueDate)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingNextDue) {
    return existingNextDue;
  }

  const nextItem = {
    ...normalizeDueItem(paidItem, userProfileId),
    due_date: nextDueDate,
    status: 'upcoming',
    paid_transaction_id: null,
    paid_at: null,
    last_reminded_at: null
  };

  const { data, error } = await client
    .from('upcoming_due')
    .insert(nextItem)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUpcomingDue() {
  const { client, userProfileId } = await getScopedQuery();
  await syncDerivedStatuses(client, userProfileId);

  const { data, error } = await client
    .from('upcoming_due')
    .select(`
      *,
      categories:category_id (id, name),
      accounts:payment_account_id (id, name, type)
    `)
    .eq('user_profile_id', userProfileId)
    .order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function createUpcomingDue(item) {
  const { client, userProfileId } = await getScopedQuery();
  const { data, error } = await client
    .from('upcoming_due')
    .insert(normalizeDueItem(item, userProfileId))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUpcomingDue(id, item) {
  const { client, userProfileId } = await getScopedQuery();
  const { data: existingItem, error: existingError } = await client
    .from('upcoming_due')
    .select('paid_transaction_id, paid_at')
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .single();

  if (existingError) {
    throw existingError;
  }

  const { user_profile_id, ...payload } = normalizeDueItem(item, userProfileId);
  payload.paid_transaction_id = existingItem.paid_transaction_id;
  payload.paid_at = existingItem.paid_at;
  payload.status = getDerivedDueStatus({
    ...payload,
    paid_transaction_id: existingItem.paid_transaction_id
  });

  const { data, error } = await client
    .from('upcoming_due')
    .update(payload)
    .eq('id', id)
    .eq('user_profile_id', userProfileId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteUpcomingDue(id) {
  const { client, userProfileId } = await getScopedQuery();
  const { error } = await client
    .from('upcoming_due')
    .delete()
    .eq('id', id)
    .eq('user_profile_id', userProfileId);

  if (error) {
    throw error;
  }
}

export async function createDuePaymentTransaction(item) {
  const transaction = await createTransaction({
    account_id: item.payment_account_id || null,
    category_id: item.category_id || null,
    project_tag_id: null,
    transaction_type: 'expense',
    amount: Number(item.amount_due || 0),
    description: item.provider ? `${item.title} - ${item.provider}` : item.title,
    transaction_date: getTodayIsoDate(),
    notes: item.notes || null
  });

  return linkDuePayment(item.id, transaction.id);
}

export async function linkDuePayment(dueId, transactionId) {
  const { client, userProfileId } = await getScopedQuery();
  const { data, error } = await client
    .from('upcoming_due')
    .update({
      paid_transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      status: 'paid'
    })
    .eq('id', dueId)
    .eq('user_profile_id', userProfileId)
    .is('paid_transaction_id', null)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  await createNextRecurringDue(client, userProfileId, data);

  return data;
}

export async function findMatchingUnpaidDueForTransaction(transaction) {
  if (transaction.transaction_type !== 'expense') {
    return null;
  }

  const { client, userProfileId } = await getScopedQuery();
  const transactionAmount = Number(transaction.amount || 0);
  const transactionDate = new Date(`${transaction.transaction_date}T00:00:00`);
  const startDate = new Date(transactionDate);
  const endDate = new Date(transactionDate);
  startDate.setDate(startDate.getDate() - 7);
  endDate.setDate(endDate.getDate() + 7);

  let query = client
    .from('upcoming_due')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .is('paid_transaction_id', null)
    .gte('due_date', startDate.toISOString().slice(0, 10))
    .lte('due_date', endDate.toISOString().slice(0, 10));

  if (transaction.account_id) {
    query = query.eq('payment_account_id', transaction.account_id);
  }

  if (transaction.category_id) {
    query = query.eq('category_id', transaction.category_id);
  }

  const { data, error } = await query.order('due_date', { ascending: true });

  if (error) {
    throw error;
  }

  const normalizedDescription = (transaction.description || '').toLowerCase();

  return data.find((item) => {
    const amountMatches = Math.abs(Number(item.amount_due || 0) - transactionAmount) < 0.01;
    const titleMatches = [item.title, item.provider]
      .filter(Boolean)
      .some((value) => normalizedDescription.includes(value.toLowerCase()));

    return amountMatches && (titleMatches || !normalizedDescription);
  }) || null;
}
