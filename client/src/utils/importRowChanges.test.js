import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportRowChange } from './importRowChanges.js';

test('transfer conversion preserves the statement side for outgoing and incoming rows', () => {
  for (const [type, direction, side] of [['expense', 'out', 'from_account_id'], ['income', 'in', 'to_account_id']]) {
    const original = { transaction_type: type, account_id: 'bank', category_id: 'food', amount: 59000 };
    const converted = normalizeImportRowChange(original, 'transaction_type', 'transfer');
    assert.equal(converted[side], 'bank');
    assert.equal(converted.money_direction, direction);
    assert.equal(converted.category_id, null);
    assert.equal(original.transaction_type, type);
    const reassigned = normalizeImportRowChange(converted, 'account_id', 'other-bank');
    assert.equal(reassigned[side], 'other-bank');
  }
});

test('changing type or activity clears incompatible categories and updates money direction', () => {
  const categories = [{ id: 'food', type: 'expense' }];
  const row = { transaction_type: 'expense', financial_activity: 'standard', category_id: 'food', money_direction: 'out' };
  const income = normalizeImportRowChange(row, 'transaction_type', 'income', categories);
  assert.equal(income.category_id, null);
  assert.equal(income.money_direction, 'in');
  const refund = normalizeImportRowChange({ ...income, category_id: 'food' }, 'financial_activity', 'refund', categories);
  assert.equal(refund.category_id, 'food');
});

test('transfer configuration preserves the other account, fee, purpose and imported values', () => {
  const row = { transaction_type: 'transfer', account_id: 'bank', from_account_id: 'bank', amount: 59000, money_direction: 'out', notes: 'Statement entry' };
  let result = normalizeImportRowChange(row, 'to_account_id', 'wallet');
  result = normalizeImportRowChange(result, 'transfer_fee', 1000);
  result = normalizeImportRowChange(result, 'transfer_purpose', 'Top up');
  assert.equal(result.from_account_id, 'bank');
  assert.equal(result.to_account_id, 'wallet');
  assert.equal(result.transfer_fee, 1000);
  assert.equal(result.transfer_purpose, 'Top up');
  assert.equal(result.amount, 59000);
  assert.equal(result.notes, row.notes);
});
