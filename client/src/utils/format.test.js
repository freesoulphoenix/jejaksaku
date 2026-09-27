import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCurrency, parseCurrencyInput } from './format.js';

test('full currency amounts preserve two decimal places for Yuan and Rupiah', () => {
  for (const [code, symbol] of [['CNY', '¥'], ['IDR', 'Rp']]) {
    globalThis.localStorage = { getItem: () => code };
    assert.equal(formatCurrency(1234.56), `${symbol} 1.234,56`);
    assert.equal(formatCurrency(12), `${symbol} 12,00`);
    assert.equal(formatCurrency(12.5), `${symbol} 12,50`);
    assert.equal(formatCurrency(-12.56), `-${symbol} 12,56`);
    assert.equal(formatCurrency(0), `${symbol} 0,00`);
    assert.equal(formatCurrency('12.56'), `${symbol} 12,56`);
    assert.equal(formatCurrency(12.567), `${symbol} 12,57`);
    for (const amount of [0, 12, 12.5, 1234.56, -12.56]) {
      assert.equal(parseCurrencyInput(formatCurrency(amount)), amount);
    }
  }
  delete globalThis.localStorage;
});
