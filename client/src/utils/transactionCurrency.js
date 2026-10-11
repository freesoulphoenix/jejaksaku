// The reporting amount is separate from the native account movements.
export function prepareTransferCurrency(form, accounts, existing = null) {
  const source = accounts.find((account) => account.id === form.from_account_id);
  const destination = accounts.find((account) => account.id === form.to_account_id);
  if (!source || !destination) throw new Error('Select both account balances.');
  if (source.id === destination.id) throw new Error('Select two different account balances.');
  const from = source.currency_code || 'IDR';
  const to = destination.currency_code || 'IDR';
  const sent = Number(form.account_amount);
  const received = from === to ? sent : Number(form.destination_amount);
  if (!Number.isFinite(sent) || sent <= 0) throw new Error('Enter a positive amount sent.');
  if (!Number.isFinite(received) || received <= 0) throw new Error('Enter a positive amount received.');
  const unchanged = existing && existing.from_account_id === source.id && existing.to_account_id === destination.id &&
    existing.primary_currency === form.primary_currency &&
    Number(existing.account_amount ?? existing.amount) === sent &&
    Number(existing.destination_amount ?? existing.account_amount ?? existing.amount) === received &&
    Number(existing.exchange_rate ?? 1) === Number(form.exchange_rate || 1);
  const reportingRate = unchanged ? Number(existing.amount) / sent
    : from === form.primary_currency ? 1
    : to === form.primary_currency ? received / sent : Number(form.exchange_rate);
  if (!Number.isFinite(reportingRate) || reportingRate <= 0) throw new Error('Enter a positive rate for the primary currency.');
  const prepared = { ...form,
    amount: sent * reportingRate,
    original_currency: from, original_amount: sent, exchange_rate: reportingRate,
    account_amount: sent, destination_amount: received,
    rate_mode: from !== form.primary_currency && to === form.primary_currency ? form.transfer_rate_mode || 'manual' : form.rate_mode || 'manual',
    rate_updated_at: from !== form.primary_currency && to === form.primary_currency ? form.transfer_rate_updated_at || null : form.rate_updated_at || null,
    transfer_exchange_rate: from === to ? null : received / sent,
    transfer_rate_mode: from === to ? null : form.transfer_rate_mode || 'manual',
    transfer_rate_updated_at: from === to || form.transfer_rate_mode !== 'automatic' ? null : form.transfer_rate_updated_at || null
  };
  return unchanged ? { ...prepared,
    amount: existing.amount,
    original_currency: existing.original_currency,
    original_amount: existing.original_amount,
    exchange_rate: existing.exchange_rate,
    rate_mode: existing.rate_mode,
    rate_updated_at: existing.rate_updated_at
  } : prepared;
}

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
