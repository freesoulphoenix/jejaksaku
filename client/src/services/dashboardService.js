import { getAccounts } from './accountService.js';
import { getTransactions } from './transactionService.js';
import { calculateAccountBalances, getTransactionAccountName } from '../utils/balance.js';
import { getReportIncomeAmount, getSpendingAmount } from '../utils/creditFacility.js';

const assetTypes = new Set(['Cash', 'Bank', 'E-Wallet', 'Investment']);
const debtTypes = new Set(['Credit Card', 'PayLater', 'Loan']);

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

function startOfLastMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function endOfLastMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 0);
}

function isOnOrAfter(dateString, compareDate) {
  if (!dateString) {
    return false;
  }

  return new Date(`${dateString}T00:00:00`) >= compareDate;
}

function isBetween(dateString, startDate, endDate) {
  if (!dateString) {
    return false;
  }

  const date = new Date(`${dateString}T00:00:00`);
  return date >= startDate && date <= endDate;
}

function isToday(dateString) {
  if (!dateString) {
    return false;
  }

  return dateString === new Date().toISOString().slice(0, 10);
}

function groupExpenseBy(transactions, getKey) {
  const grouped = new Map();

  transactions.forEach((transaction) => {
    if (!getSpendingAmount(transaction)) {
      return;
    }

    const key = getKey(transaction) || 'Other';
    grouped.set(key, (grouped.get(key) || 0) + getSpendingAmount(transaction));
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
  const accountsWithBalances = calculateAccountBalances(accounts, transactions);

  const assets = accountsWithBalances
    .filter((account) => assetTypes.has(account.type))
    .reduce((sum, account) => sum + Number(account.reconciled_balance || 0), 0);

  const debt = accountsWithBalances
    .filter((account) => debtTypes.has(account.type))
    .reduce((sum, account) => sum + Math.abs(Number(account.reconciled_balance || 0)), 0);

  const today = startOfToday();
  const week = startOfWeek();
  const month = startOfMonth();
  const lastMonthStart = startOfLastMonth();
  const lastMonthEnd = endOfLastMonth();

  const todaySpending = transactions
    .filter((transaction) => isToday(transaction.transaction_date))
    .reduce((sum, transaction) => sum + getSpendingAmount(transaction), 0);

  const weekSpending = transactions
    .filter((transaction) => isOnOrAfter(transaction.transaction_date, week))
    .reduce((sum, transaction) => sum + getSpendingAmount(transaction), 0);

  const monthTransactions = transactions.filter((transaction) => isOnOrAfter(transaction.transaction_date, month));
  const lastMonthTransactions = transactions.filter((transaction) => (
    isBetween(transaction.transaction_date, lastMonthStart, lastMonthEnd)
  ));

  const monthSpending = monthTransactions
    .reduce((sum, transaction) => sum + getSpendingAmount(transaction), 0);

  const monthIncome = monthTransactions
    .reduce((sum, transaction) => sum + getReportIncomeAmount(transaction), 0);

  const lastMonthSpending = lastMonthTransactions
    .reduce((sum, transaction) => sum + getSpendingAmount(transaction), 0);

  const lastMonthIncome = lastMonthTransactions
    .reduce((sum, transaction) => sum + getReportIncomeAmount(transaction), 0);

  return {
    accounts: accountsWithBalances,
    transactions,
    recentTransactions: transactions.slice(0, 4),
    summary: {
      assets,
      debt,
      lastMonthIncome,
      lastMonthNet: lastMonthIncome - lastMonthSpending,
      lastMonthSpending,
      netWorth: assets - debt,
      todaySpending,
      weekSpending,
      monthSpending,
      monthIncome,
      dueThisMonth: 0
    },
    topSpendingCategories: groupExpenseBy(monthTransactions, (transaction) => transaction.categories?.name),
    spendingByAccount: groupExpenseBy(monthTransactions, getTransactionAccountName),
    spendingByProjectTag: groupExpenseBy(monthTransactions, (transaction) => transaction.project_tags?.name)
  };
}
