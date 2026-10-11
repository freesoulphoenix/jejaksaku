import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccountAmounts } from './transactionCurrency.js';
import { calculateAccountBalances, getTransactionAccountDeltas } from './balance.js';
import { formatCurrency } from './format.js';

const source = { id: 'cny', currency_code: 'CNY', opening_balance: 2000, balance: 1800 };
const destination = { id: 'idr', currency_code: 'IDR', opening_balance: 5000000, balance: 5500000 };

test('foreign expense deducts native amount while retaining frozen primary amount', () => {
  const transaction = resolveAccountAmounts({ transaction_type: 'expense', account_id: 'cny', primary_currency: 'IDR', original_currency: 'CNY', original_amount: 200, amount: 500000, exchange_rate: 2500, account_amount: 99 }, source);
  assert.equal(transaction.amount, 500000);
  assert.equal(transaction.exchange_rate, 2500);
  assert.equal(transaction.account_amount, 200);
  const balances = calculateAccountBalances([source, destination], [transaction]);
  assert.equal(balances[0].calculated_balance, 1800);
  assert.equal(balances[1].calculated_balance, 5000000);
});

test('cross-currency transfer records actual received value and source fee', () => {
  const transaction = resolveAccountAmounts({ transaction_type: 'transfer', from_account_id: 'cny', to_account_id: 'idr', primary_currency: 'IDR', original_currency: 'CNY', original_amount: 200, amount: 500000, destination_amount: 495000, transfer_fee: 2 }, source, destination);
  assert.equal(transaction.primary_transfer_fee, 5000);
  assert.deepEqual(getTransactionAccountDeltas(transaction), [{ accountId: 'cny', amount: -202 }, { accountId: 'idr', amount: 495000 }]);
});

test('secondary purchase charged to primary account uses converted amount', () => {
  const transaction = resolveAccountAmounts({ transaction_type: 'expense', primary_currency: 'IDR', original_currency: 'CNY', original_amount: 200, amount: 500000, account_amount: 200 }, destination);
  assert.equal(transaction.account_amount, 500000);
});

test('missing original amount or destination amount rejects ambiguous currency movement', () => {
  assert.throws(() => resolveAccountAmounts({ primary_currency: 'IDR', amount: 200 }, source), /original amount/);
  assert.throws(() => resolveAccountAmounts({ transaction_type: 'transfer', primary_currency: 'IDR', original_currency: 'CNY', original_amount: 200, amount: 500000 }, source, destination), /amount received/);
});

test('same-currency transfers ignore stale destination amounts', () => {
  const transaction = resolveAccountAmounts({ transaction_type: 'transfer', primary_currency: 'IDR', amount: 200, destination_amount: 500000 }, destination, destination);
  assert.equal(transaction.destination_amount, 200);
});

test('currency formatting supports end position and configured decimal places', () => {
  globalThis.localStorage = { getItem(key) { return key === 'jejaksaku_currency_preferences' ? JSON.stringify({ primary: 'IDR', secondary: 'CNY', formats: { IDR: { position: 'end', decimals: 0 } } }) : 'IDR'; } };
  assert.equal(formatCurrency(1234.56), '1,235 Rp');
  assert.equal(formatCurrency(-1234.56), '-1,235 Rp');
  delete globalThis.localStorage;
});
