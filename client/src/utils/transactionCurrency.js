// The reporting amount is separate from the native account movements.
export function resolveAccountAmounts(transaction, source, destination) {
  const primary = transaction.primary_currency;
  const currency = transaction.original_currency || primary;
  const nativeCurrency = source.currency_code || 'IDR';
  if (nativeCurrency !== primary && transaction.original_amount == null) {
    throw new Error(`Enter the original amount and rate for the ${nativeCurrency} account.`);
  }
  const accountAmount = nativeCurrency === primary
    ? transaction.amount
    : nativeCurrency === currency ? transaction.original_amount : Number(transaction.account_amount);
  if (!Number.isFinite(accountAmount) || accountAmount <= 0) throw new Error('Enter a positive actual account amount.');
  let destinationAmount = null;
  if (transaction.transaction_type === 'transfer') {
    destinationAmount = (destination.currency_code || 'IDR') === nativeCurrency
      ? accountAmount : Number(transaction.destination_amount);
    if (!Number.isFinite(destinationAmount) || destinationAmount <= 0) throw new Error('Enter the amount received in the destination currency.');
  }
  const fee = Number(transaction.transfer_fee || 0);
  if (!Number.isFinite(fee) || fee < 0) throw new Error('Transfer fee must be zero or positive.');
  return { ...transaction, account_amount: accountAmount, destination_amount: destinationAmount, primary_transfer_fee: fee * transaction.amount / accountAmount };
}
