export function getTransactionAccountDeltas(transaction) {
  const amount = Math.abs(Number(transaction.amount || 0));
  const fee = Math.abs(Number(transaction.transfer_fee || 0));

  if (transaction.transaction_type === 'income') {
    return [{ accountId: transaction.account_id, amount }];
  }

  if (transaction.transaction_type === 'expense') {
    return [{ accountId: transaction.account_id, amount: -amount }];
  }

  if (transaction.transaction_type === 'transfer') {
    return [
      { accountId: transaction.from_account_id || transaction.account_id, amount: -(amount + fee) },
      { accountId: transaction.to_account_id, amount }
    ];
  }

  return [];
}

export function calculateAccountBalances(accounts = [], transactions = []) {
  const balances = new Map();

  accounts.forEach((account) => {
    balances.set(account.id, Number(account.opening_balance ?? account.balance ?? 0));
  });

  transactions.forEach((transaction) => {
    getTransactionAccountDeltas(transaction).forEach((delta) => {
      if (!delta.accountId) {
        return;
      }

      balances.set(delta.accountId, (balances.get(delta.accountId) || 0) + delta.amount);
    });
  });

  return accounts.map((account) => {
    const calculatedBalance = balances.get(account.id) || 0;
    const reconciledBalance = Number(account.balance || 0);

    return {
      ...account,
      calculated_balance: calculatedBalance,
      reconciled_balance: reconciledBalance,
      balance_difference: reconciledBalance - calculatedBalance
    };
  });
}

export function getTransactionAccountName(transaction) {
  if (transaction.transaction_type === 'transfer') {
    const fromName = transaction.from_account?.name || transaction.accounts?.name || 'From account';
    const toName = transaction.to_account?.name || 'To account';
    return `${fromName} -> ${toName}`;
  }

  return transaction.accounts?.name || transaction.account || 'No account';
}
