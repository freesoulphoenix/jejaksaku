import { resolveMoneyDirection } from './transactionDirection.js';
import { getTransactionCategoryType } from './categoryOptions.js';

export function normalizeImportRowChange(row, field, value, categories = []) {
  const nextRow = { ...row, [field]: value };

  if (field === 'transaction_type' && value !== 'transfer') {
    nextRow.money_direction = resolveMoneyDirection(nextRow);
  }

  if (field === 'transaction_type' && value === 'transfer') {
    nextRow.category_id = null;
    nextRow.money_direction = resolveMoneyDirection(row);

    if (nextRow.money_direction === 'out' && nextRow.account_id && !nextRow.from_account_id) {
      nextRow.from_account_id = nextRow.account_id;
    }

    if (nextRow.money_direction === 'in' && nextRow.account_id && !nextRow.to_account_id) {
      nextRow.to_account_id = nextRow.account_id;
    }
  }

  if (field === 'account_id' && nextRow.transaction_type === 'transfer') {
    if (nextRow.money_direction === 'out') {
      nextRow.from_account_id = value;
    } else if (nextRow.money_direction === 'in') {
      nextRow.to_account_id = value;
    }
  }

  if (field === 'transaction_type' || field === 'financial_activity') {
    const nextCategoryType = getTransactionCategoryType(
      nextRow.transaction_type,
      nextRow.financial_activity
    );
    const selectedCategory = categories.find((category) => category.id === nextRow.category_id);

    if (!nextCategoryType || (selectedCategory && selectedCategory.type !== nextCategoryType)) {
      nextRow.category_id = null;
    }
  }

  return nextRow;
}

