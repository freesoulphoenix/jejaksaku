import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTransferCurrency, resolveAccountAmounts } from './transactionCurrency.js';
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

test('same-bank IDR to RMB transfer credits only the separate RMB balance', () => {
  const accounts = [
    { id: 'bank-idr', name: 'Bank A', currency_code: 'IDR', balance: 1000000, opening_balance: 1000000 },
    { id: 'bank-cny', name: 'Bank A', currency_code: 'CNY', balance: 200, opening_balance: 200 }
  ];
  const form = { transaction_type: 'transfer', from_account_id: 'bank-idr', to_account_id: 'bank-cny', primary_currency: 'IDR', account_amount: 250000, destination_amount: 100, transfer_fee: 5000, transfer_rate_mode: 'manual' };
  const payload = resolveAccountAmounts(prepareTransferCurrency(form, accounts), accounts[0], accounts[1]);
  assert.equal(payload.amount, 250000);
  assert.equal(payload.transfer_exchange_rate, 0.0004);
  const balances = calculateAccountBalances(accounts, [payload]);
  assert.equal(balances[0].calculated_balance, 745000);
  assert.equal(balances[1].calculated_balance, 300);
  const reversed = getTransactionAccountDeltas(payload).map((delta) => ({ ...delta, amount: -delta.amount }));
  assert.deepEqual(reversed, [{ accountId: 'bank-idr', amount: 255000 }, { accountId: 'bank-cny', amount: -100 }]);
});

test('same-bank transfer uses the received amount when primary currency is RMB', () => {
  const accounts = [{ id: 'bank-idr', name: 'Bank A', currency_code: 'IDR' }, { id: 'bank-cny', name: 'Bank A', currency_code: 'CNY' }];
  const payload = prepareTransferCurrency({ transaction_type: 'transfer', from_account_id: 'bank-idr', to_account_id: 'bank-cny', primary_currency: 'CNY', account_amount: 250000, destination_amount: 100, transfer_rate_mode: 'automatic', transfer_rate_updated_at: '2026-10-11T00:00:00Z' }, accounts);
  assert.equal(payload.amount, 100);
  assert.equal(payload.original_amount, 250000);
  assert.equal(payload.exchange_rate, 0.0004);
  assert.equal(payload.rate_updated_at, '2026-10-11T00:00:00Z');
  assert.deepEqual(getTransactionAccountDeltas(payload), [{ accountId: 'bank-idr', amount: -250000 }, { accountId: 'bank-cny', amount: 100 }]);
});

test('reverse same-bank RMB to IDR transfer and a third reporting currency', () => {
  const accounts = [{ id: 'bank-idr', name: 'Bank A', currency_code: 'IDR' }, { id: 'bank-cny', name: 'Bank A', currency_code: 'CNY' }];
  const form = { transaction_type: 'transfer', from_account_id: 'bank-cny', to_account_id: 'bank-idr', account_amount: 100, destination_amount: 250000, primary_currency: 'USD', exchange_rate: 0.14 };
  const payload = prepareTransferCurrency(form, accounts);
  assert.ok(Math.abs(payload.amount - 14) < 1e-10);
  assert.equal(payload.transfer_exchange_rate, 2500);
  assert.equal(payload.exchange_rate, 0.14);
  assert.deepEqual(getTransactionAccountDeltas(payload), [{ accountId: 'bank-cny', amount: -100 }, { accountId: 'bank-idr', amount: 250000 }]);
  assert.throws(() => prepareTransferCurrency({ ...form, to_account_id: 'bank-cny' }, accounts), /two different/);
});

test('editing a transfer description preserves the saved reporting conversion', () => {
  const accounts = [{ id: 'bank-idr', currency_code: 'IDR' }, { id: 'bank-cny', currency_code: 'CNY' }];
  const existing = { transaction_type: 'transfer', from_account_id: 'bank-idr', to_account_id: 'bank-cny', primary_currency: 'CNY', account_amount: 250000, destination_amount: 100, original_currency: 'IDR', original_amount: 250000, exchange_rate: 0.00041, amount: 102.5, rate_mode: 'manual' };
  const payload = prepareTransferCurrency({ ...existing, description: 'Updated description' }, accounts, existing);
  assert.equal(payload.amount, 102.5);
  assert.equal(payload.exchange_rate, 0.00041);
  assert.equal(payload.account_amount, 250000);
  assert.equal(payload.destination_amount, 100);
});

test('currency formatting supports end position and configured decimal places', () => {
  globalThis.localStorage = { getItem(key) { return key === 'jejaksaku_currency_preferences' ? JSON.stringify({ primary: 'IDR', secondary: 'CNY', formats: { IDR: { position: 'end', decimals: 0 } } }) : 'IDR'; } };
  assert.equal(formatCurrency(1234.56), '1,235 Rp');
  assert.equal(formatCurrency(-1234.56), '-1,235 Rp');
  delete globalThis.localStorage;
});
