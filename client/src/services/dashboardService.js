import { getAccounts } from './accountService.js';
import { getTransactions } from './transactionService.js';

const assetTypes = new Set(['Cash', 'Bank', 'E-Wallet', 'Investment']);
const debtTypes = new Set(['PayLater', 'Loan']);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const mondayOffset = (day + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isOnOrAfter(dateString, compareDate) {
  if (!dateString) {
    return false;
  }

  return new Date(`${dateString}T00:00:00`) >= compareDate;
}

function isToday(dateString) {
  if (!dateString) {
    return false;
  }

  return dateString === new Date().toISOString().slice(0, 10);
}

function getExpenseAmount(transaction) {
  return transaction.transaction_type === 'expense' ? Math.abs(Number(transaction.amount || 0)) : 0;
}

function groupExpenseBy(transactions, getKey) {
  const grouped = new Map();

  transactions.forEach((transaction) => {
    if (transaction.transaction_type !== 'expense') {
      return;
    }

    const key = getKey(transaction) || 'Other';
    grouped.set(key, (grouped.get(key) || 0) + getExpenseAmount(transaction));
  });

  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getDashboardData() {
  const [accounts, transactions] = await Promise.all([
    getAccounts(),
    getTransactions()
  ]);

  const assets = accounts
    .filter((account) => assetTypes.has(account.type))
    .reduce((sum, account) => sum + Number(account.balance || 0), 0);

  const debt = accounts
    .filter((account) => debtTypes.has(account.type))
    .reduce((sum, account) => sum + Math.abs(Number(account.balance || 0)), 0);

  const today = startOfToday();
  const week = startOfWeek();
  const month = startOfMonth();

  const todaySpending = transactions
    .filter((transaction) => isToday(transaction.transaction_date))
    .reduce((sum, transaction) => sum + getExpenseAmount(transaction), 0);

  const weekSpending = transactions
    .filter((transaction) => isOnOrAfter(transaction.transaction_date, week))
    .reduce((sum, transaction) => sum + getExpenseAmount(transaction), 0);

  const monthTransactions = transactions.filter((transaction) => isOnOrAfter(transaction.transaction_date, month));

  const monthSpending = monthTransactions
    .reduce((sum, transaction) => sum + getExpenseAmount(transaction), 0);

  const monthIncome = monthTransactions
    .filter((transaction) => transaction.transaction_type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return {
    accounts,
    transactions,
    recentTransactions: transactions.slice(0, 4),
    summary: {
      assets,
      debt,
      netWorth: assets - debt,
      todaySpending,
      weekSpending,
      monthSpending,
      monthIncome,
      dueThisMonth: 0
    },
    topSpendingCategories: groupExpenseBy(monthTransactions, (transaction) => transaction.categories?.name),
    spendingByAccount: groupExpenseBy(monthTransactions, (transaction) => transaction.accounts?.name),
    spendingByProjectTag: groupExpenseBy(monthTransactions, (transaction) => transaction.project_tags?.name)
  };
}
