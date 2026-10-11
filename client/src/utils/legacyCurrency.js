export function canCorrectAccountCurrency(account, transactions = []) {
  const linked = transactions.filter((transaction) => [transaction.account_id, transaction.from_account_id, transaction.to_account_id].includes(account.id));
  if (linked.length === 0) return true;
  return linked.every((transaction) =>
    transaction.original_amount == null && transaction.exchange_rate == null &&
    transaction.account_amount == null && transaction.destination_amount == null
  );
}
