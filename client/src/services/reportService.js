import { getAccounts } from './accountService.js';
import { getCategories } from './categoryService.js';
import { getProjectTags } from './projectTagService.js';
import { getTransactions } from './transactionService.js';
import { calculateAccountBalances, getTransactionAccountName } from '../utils/balance.js';

function getMonthKey(dateString) {
  return String(dateString || '').slice(0, 7);
}

function getMonthLabel(monthKey) {
  if (!monthKey) {
    return 'No date';
  }

  const date = new Date(`${monthKey}-01T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
}

function getExpenseAmount(transaction) {
  if (transaction.transaction_type === 'transfer') {
    return Math.abs(Number(transaction.transfer_fee || 0));
  }

  return transaction.transaction_type === 'expense' ? Math.abs(Number(transaction.amount || 0)) : 0;
}

function getIncomeAmount(transaction) {
  return transaction.transaction_type === 'income' ? Number(transaction.amount || 0) : 0;
}

function sumValues(items, getValue) {
  return items.reduce((sum, item) => sum + getValue(item), 0);
}

function groupBy(transactions, getKey, getValue) {
  const grouped = new Map();

  transactions.forEach((transaction) => {
    const value = getValue(transaction);

    if (!value) {
      return;
    }

    const label = getKey(transaction) || 'Other';
    grouped.set(label, (grouped.get(label) || 0) + value);
  });

  return [...grouped.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildMonthlySeries(transactions) {
  const months = new Map();

  transactions.forEach((transaction) => {
    const monthKey = getMonthKey(transaction.transaction_date);

    if (!monthKey) {
      return;
    }

    const current = months.get(monthKey) || {
      cashFlow: 0,
      income: 0,
      month: getMonthLabel(monthKey),
      monthKey,
      spending: 0
    };

    current.spending += getExpenseAmount(transaction);
    current.income += getIncomeAmount(transaction);
    current.cashFlow = current.income - current.spending;
    months.set(monthKey, current);
  });

  return [...months.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function buildNetWorthTrend(accounts, monthlySeries) {
  const currentNetWorth = accounts.reduce((sum, account) => sum + Number(account.reconciled_balance ?? account.balance ?? 0), 0);
  let runningNetWorth = currentNetWorth - monthlySeries.reduce((sum, item) => sum + item.cashFlow, 0);

  return monthlySeries.map((item) => {
    runningNetWorth += item.cashFlow;
    return {
      month: item.month,
      value: runningNetWorth
    };
  });
}

function filterTransactions(transactions, filters) {
  return transactions.filter((transaction) => {
    const date = transaction.transaction_date || '';
    const matchesStart = !filters.startDate || date >= filters.startDate;
    const matchesEnd = !filters.endDate || date <= filters.endDate;
    const matchesAccount = !filters.accountId
      || transaction.account_id === filters.accountId
      || transaction.from_account_id === filters.accountId
      || transaction.to_account_id === filters.accountId;
    const matchesCategory = !filters.categoryId || transaction.category_id === filters.categoryId;
    const matchesProjectTag = !filters.projectTagId || transaction.project_tag_id === filters.projectTagId;

    return matchesStart && matchesEnd && matchesAccount && matchesCategory && matchesProjectTag;
  });
}

export async function getReportData(filters = {}) {
  const [accounts, categories, projectTags, transactions] = await Promise.all([
    getAccounts(),
    getCategories(),
    getProjectTags(),
    getTransactions()
  ]);
  const accountsWithBalances = calculateAccountBalances(accounts, transactions);
  const filteredTransactions = filterTransactions(transactions, filters);
  const monthlySeries = buildMonthlySeries(filteredTransactions);
  const monthlySpending = sumValues(filteredTransactions, getExpenseAmount);
  const monthlyIncome = sumValues(filteredTransactions, getIncomeAmount);

  return {
    accounts: accountsWithBalances,
    accountBreakdown: groupBy(filteredTransactions, getTransactionAccountName, getExpenseAmount),
    cashFlow: monthlyIncome - monthlySpending,
    categoryBreakdown: groupBy(filteredTransactions, (transaction) => transaction.categories?.name, getExpenseAmount),
    categories,
    filteredTransactions,
    monthlyIncome,
    monthlySeries,
    monthlySpending,
    netWorthTrend: buildNetWorthTrend(accountsWithBalances, monthlySeries),
    projectTagBreakdown: groupBy(filteredTransactions, (transaction) => transaction.project_tags?.name, getExpenseAmount),
    projectTags
  };
}
