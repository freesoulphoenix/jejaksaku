import { supabase } from './supabaseClient.js';
import { getCurrentUserProfileId } from './userProfileService.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function dateDistanceInDays(firstDate, secondDate) {
  const first = new Date(`${firstDate}T00:00:00`);
  const second = new Date(`${secondDate}T00:00:00`);
  return Math.abs(Math.round((first - second) / 86400000));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasSimilarMerchant(first, second) {
  const firstText = normalizeText(first);
  const secondText = normalizeText(second);

  if (!firstText || !secondText) {
    return false;
  }

  return firstText.includes(secondText) || secondText.includes(firstText);
}

function sameAmount(firstAmount, secondAmount) {
  return Math.abs(Math.abs(Number(firstAmount || 0)) - Math.abs(Number(secondAmount || 0))) < 0.01;
}

function getDirection(value) {
  if (value.money_direction) {
    return value.money_direction;
  }

  if (value.transaction_type === 'income') {
    return 'in';
  }

  if (value.transaction_type === 'expense') {
    return 'out';
  }

  return Number(value.amount || 0) < 0 ? 'out' : 'in';
}

function hasCompatibleDirection(first, second) {
  return getDirection(first) === getDirection(second);
}

export async function findSmartMatch(importedTransaction) {
  const userProfileId = await getCurrentUserProfileId();
  const client = requireSupabase();
  const startDate = new Date(`${importedTransaction.transaction_date}T00:00:00`);
  const endDate = new Date(startDate);
  startDate.setDate(startDate.getDate() - 3);
  endDate.setDate(endDate.getDate() + 3);
  const fromDate = startDate.toISOString().slice(0, 10);
  const toDate = endDate.toISOString().slice(0, 10);

  const [transactionsResponse, dueResponse] = await Promise.all([
    client
      .from('transactions')
      .select('*')
      .eq('user_profile_id', userProfileId)
      .gte('transaction_date', fromDate)
      .lte('transaction_date', toDate),
    client
      .from('upcoming_due')
      .select('*')
      .eq('user_profile_id', userProfileId)
      .is('paid_transaction_id', null)
      .gte('due_date', fromDate)
      .lte('due_date', toDate)
  ]);

  if (transactionsResponse.error) {
    throw transactionsResponse.error;
  }

  if (dueResponse.error) {
    throw dueResponse.error;
  }

  const existingTransaction = transactionsResponse.data.find((transaction) => (
    sameAmount(transaction.amount, importedTransaction.amount) &&
    (!importedTransaction.account_id || transaction.account_id === importedTransaction.account_id) &&
    hasCompatibleDirection(transaction, importedTransaction) &&
    dateDistanceInDays(transaction.transaction_date, importedTransaction.transaction_date) <= 3 &&
    hasSimilarMerchant(transaction.description, importedTransaction.clean_description || importedTransaction.description)
  ));

  if (existingTransaction) {
    return {
      target: existingTransaction,
      type: 'existing_transaction',
      title: 'Existing Transaction',
      message: `This looks like ${existingTransaction.description}.`
    };
  }

  const dueMatch = dueResponse.data.find((item) => (
    sameAmount(item.amount_due, importedTransaction.amount) &&
    dateDistanceInDays(item.due_date, importedTransaction.transaction_date) <= 3 &&
    [item.title, item.provider].some((value) => hasSimilarMerchant(value, importedTransaction.clean_description || importedTransaction.description))
  ));

  if (dueMatch) {
    return {
      target: dueMatch,
      type: dueMatch.recurring_enabled ? 'recurring_bill' : 'upcoming_due',
      title: dueMatch.recurring_enabled ? 'Recurring Bill' : 'Upcoming Due',
      message: `This looks like ${dueMatch.title}.`
    };
  }

  return null;
}
