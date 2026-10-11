import test from 'node:test';
import assert from 'node:assert/strict';
import { canCorrectAccountCurrency } from './legacyCurrency.js';

test('older currency labels remain editable without converted amounts', () => {
  const account = { id: 'rmb', currency_code: 'IDR', currency_confirmed: false };
  const activities = [{ account_id: 'rmb', amount: 200, primary_currency: 'IDR' }];
  assert.equal(canCorrectAccountCurrency(account, activities), true);
  assert.equal(canCorrectAccountCurrency({ ...account, currency_code: 'CNY', currency_confirmed: true }, activities), true);
});

test('unused accounts can change currency but explicit rate records protect saved conversions', () => {
  const account = { id: 'rmb', currency_confirmed: false };
  assert.equal(canCorrectAccountCurrency(account, []), true);
  for (const fields of [{ original_amount: 200 }, { exchange_rate: 2500 }, { account_amount: 200 }, { destination_amount: 500000 }]) {
    assert.equal(canCorrectAccountCurrency(account, [{ account_id: 'rmb', ...fields }]), false);
  }
});

test('both transfer sides participate in the currency edit check', () => {
  const transfer = { from_account_id: 'cny', to_account_id: 'idr', original_amount: 200, exchange_rate: 2500 };
  assert.equal(canCorrectAccountCurrency({ id: 'cny' }, [transfer]), false);
  assert.equal(canCorrectAccountCurrency({ id: 'idr' }, [transfer]), false);
  assert.equal(canCorrectAccountCurrency({ id: 'other' }, [transfer]), true);
});
