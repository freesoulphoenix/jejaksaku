import test from 'node:test';
import assert from 'node:assert/strict';
import { findPurchasePairs, purchaseMatch, resolvePurchaseFields } from './purchaseMatching.js';

const receipt = { id: 'receipt-entry', receipt_id: 'receipt', account_id: 'mega', amount: 113200, primary_currency: 'IDR', transaction_date: '2026-05-27', transaction_type: 'expense', description: 'Weekly groceries', category_id: 'groceries', financial_activity: 'standard' };
const statement = { id: 'statement-entry', imported_transaction_id: 'statement', account_id: 'mega', amount: '113200.00', primary_currency: 'IDR', transaction_date: '2026-05-27', transaction_type: 'expense', description: 'RANCH MARKET LOTTE JKT', category_id: 'daily', financial_activity: 'standard' };

test('matches different descriptions and categories across sources in either order', () => {
  assert.ok(purchaseMatch(receipt, statement));
  assert.ok(purchaseMatch(statement, receipt));
});
test('daily repeated purchases do not match even with identical merchant and amount', () => {
  assert.equal(purchaseMatch({ ...receipt, description: 'RANCH MARKET' }, { ...statement, description: 'RANCH MARKET', transaction_date: '2026-05-28' }), null);
});
test('manual input can match receipt or statement but same-source purchases remain separate', () => {
  const manual = { ...receipt, id: 'manual', receipt_id: null };
  assert.ok(purchaseMatch(manual, receipt));
  assert.ok(purchaseMatch(manual, statement));
  assert.equal(purchaseMatch(receipt, { ...receipt, id: 'receipt2', receipt_id: 'other-receipt' }), null);
  assert.equal(purchaseMatch(manual, { ...manual, id: 'manual2' }), null);
});
test('different account, currency, amount, direction and transfers are excluded', () => {
  for (const change of [{ account_id: 'bca' }, { primary_currency: 'USD' }, { amount: 113201 }, { transaction_type: 'income' }, { transaction_type: 'transfer' }]) {
    assert.equal(purchaseMatch(receipt, { ...statement, ...change }), null);
  }
});
test('unknown account lowers confidence', () => {
  assert.equal(purchaseMatch(receipt, { ...statement, account_id: null }).confidence, 'Possible match');
});
test('nearby dates require merchant evidence and an explicit posting date', () => {
  const a = { ...receipt, description: 'Ranch Market LOTTE MALL' };
  const b = { ...statement, description: 'RANCH MARKET LOTTE JKT', transaction_date: '2026-05-28', posting_date: '2026-05-28' };
  assert.equal(purchaseMatch(a, b).confidence, 'Possible match');
  assert.equal(purchaseMatch(receipt, b), null);
  assert.equal(purchaseMatch(a, { ...b, transaction_date: '2026-06-02' }), null);
});
test('compares original purchase currency rather than converted reporting totals', () => {
  const a = { ...receipt, amount: 1700000, original_currency: 'USD', original_amount: 100 };
  const b = { ...statement, amount: 1710000, original_currency: 'USD', original_amount: 100 };
  assert.ok(purchaseMatch(a, b));
});
test('remembered Keep Both suppresses exactly that pair while retaining other candidates', () => {
  const manual = { ...receipt, id: 'manual', receipt_id: null };
  const pairs = findPurchasePairs([receipt, statement, manual], [{ first_transaction_id: statement.id, second_transaction_id: receipt.id }]);
  assert.equal(pairs.length, 2);
  assert.ok(pairs.every((pair) => pair.second.id === manual.id));
});
test('conflicting fields require explicit choices and single values are preserved', () => {
  assert.throws(() => resolvePurchaseFields(receipt, statement), /Choose/);
  const result = resolvePurchaseFields(receipt, { ...statement, notes: 'Statement note' }, { description: 'first', category_id: 'second' });
  assert.equal(result.description, 'Weekly groceries');
  assert.equal(result.category_id, 'daily');
  assert.equal(result.notes, 'Statement note');
  assert.equal(result.financial_activity, 'standard');
});
