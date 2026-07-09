import { getAccounts } from './accountService.js';
import { getCategories } from './categoryService.js';
import { getProjectTags } from './projectTagService.js';
import { getTransactions } from './transactionService.js';
import { calculateAccountBalances, getTransactionAccountName } from '../utils/balance.js';
import { getReportIncomeAmount, getSpendingAmount } from '../utils/creditFacility.js';

const assetTypes = new Set(['Cash', 'Bank', 'E-Wallet', 'Investment']);
const liabilityTypes = new Set(['Credit Card', 'PayLater', 'Loan']);

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

function getTopCategoryName(transaction, categoryById) {
  const categoryId = transaction.category_id || transaction.categories?.id;
  let category = categoryById.get(categoryId);
  let topCategory = category;

  while (category?.parent_category_id) {
    category = categoryById.get(category.parent_category_id);

    if (category) {
      topCategory = category;
    }
  }

  return topCategory?.name || transaction.categories?.name || 'Other';
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

    current.spending += getSpendingAmount(transaction);
    current.income += getReportIncomeAmount(transaction);
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
      monthKey: item.monthKey,
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
  const monthlySpending = sumValues(filteredTransactions, getSpendingAmount);
  const monthlyIncome = sumValues(filteredTransactions, getReportIncomeAmount);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const assets = accountsWithBalances
    .filter((account) => assetTypes.has(account.type))
    .reduce((sum, account) => sum + Number(account.reconciled_balance || 0), 0);
  const liabilities = accountsWithBalances
    .filter((account) => liabilityTypes.has(account.type))
    .reduce((sum, account) => sum + Math.abs(Number(account.reconciled_balance || 0)), 0);

  return {
    accounts: accountsWithBalances,
    accountBreakdown: groupBy(filteredTransactions, getTransactionAccountName, getSpendingAmount),
    cashFlow: monthlyIncome - monthlySpending,
    categories,
    filteredTransactions,
    incomeBreakdown: groupBy(filteredTransactions, (transaction) => getTopCategoryName(transaction, categoryById), getReportIncomeAmount),
    monthlyIncome,
    monthlySeries,
    monthlySpending,
    netWorthTrend: buildNetWorthTrend(accountsWithBalances, monthlySeries),
    netWorthSummary: {
      assets,
      liabilities,
      netWorth: assets - liabilities
    },
    projectTagBreakdown: groupBy(filteredTransactions, (transaction) => transaction.project_tags?.name, getSpendingAmount),
    projectTags,
    topCategoryBreakdown: groupBy(filteredTransactions, (transaction) => getTopCategoryName(transaction, categoryById), getSpendingAmount)
  };
}
