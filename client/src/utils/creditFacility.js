export const creditFacilityTypes = new Set(['Credit Card', 'PayLater']);

const paymentPattern = /\b(payment received|payment|pembayaran|bayar kartu|autopay|auto payment|credit card payment|card payment|cc payment)\b/i;
const refundPattern = /\b(refund|reversal|reversed|reimburse|pengembalian|retur|void)\b/i;
const feePattern = /\b(fee|charge fee|annual fee|late fee|interest|bunga|biaya|denda|materai)\b/i;
const cashAdvancePattern = /\b(cash advance|tarik tunai|penarikan tunai)\b/i;
const installmentPattern = /\b(installment|instalment|cicilan|angsuran)\b/i;

export function isCreditFacility(account) {
  return Boolean(account && creditFacilityTypes.has(account.type));
}

export function getCreditFacilityMetrics(account = {}) {
  const outstandingDebt = Math.abs(Math.min(Number(
    account.reconciled_balance ?? account.balance ?? 0
  ), 0));
  const creditLimit = Math.max(Number(account.credit_limit || 0), 0);
  const availableCredit = creditLimit ? Math.max(creditLimit - outstandingDebt, 0) : null;
  const utilizationPercent = creditLimit ? (outstandingDebt / creditLimit) * 100 : null;

  return {
    availableCredit,
    creditLimit,
    outstandingDebt,
    utilizationPercent
  };
}

export function classifyCreditStatementRow(row, sourceAccount) {
  if (!isCreditFacility(sourceAccount)) {
    return row;
  }

  const description = [
    row.raw_description,
    row.clean_description,
    row.description
  ].filter(Boolean).join(' ');

  if (paymentPattern.test(description)) {
    return {
      ...row,
      financial_activity: 'payment',
      import_status: 'needs_review',
      money_direction: 'in',
      transaction_type: 'transfer',
      to_account_id: sourceAccount.id
    };
  }

  if (refundPattern.test(description) || row.transaction_type === 'income') {
    return {
      ...row,
      financial_activity: 'refund',
      money_direction: 'in',
      transaction_type: 'income'
    };
  }

  if (cashAdvancePattern.test(description)) {
    return {
      ...row,
      financial_activity: 'cash_advance',
      import_status: 'needs_review'
    };
  }

  if (feePattern.test(description)) {
    return {
      ...row,
      financial_activity: 'fee',
      transaction_type: 'expense'
    };
  }

  if (installmentPattern.test(description)) {
    return {
      ...row,
      financial_activity: 'installment',
      transaction_type: 'expense'
    };
  }

  return {
    ...row,
    financial_activity: 'standard',
    transaction_type: 'expense'
  };
}

export function getSpendingAmount(transaction) {
  const amount = Math.abs(Number(transaction.amount || 0));

  if (transaction.financial_activity === 'refund') {
    return -amount;
  }

  if (transaction.transaction_type === 'transfer') {
    return Math.abs(Number(transaction.transfer_fee || 0));
  }

  return transaction.transaction_type === 'expense' ? amount : 0;
}

export function getReportIncomeAmount(transaction) {
  if (transaction.financial_activity === 'refund') {
    return 0;
  }

  return transaction.transaction_type === 'income'
    ? Math.abs(Number(transaction.amount || 0))
    : 0;
}
