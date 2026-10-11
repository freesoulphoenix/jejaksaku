import test from 'node:test';
import assert from 'node:assert/strict';
import { getExchangeRate } from './exchangeRateService.js';

test('daily rates refresh, persist and fall back offline without losing provider timestamp', async () => {
  const storage = new Map();
  const originalFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: 'success', base_code: 'CNY', rates: { IDR: 2500 }, time_last_update_unix: 100000, time_next_update_unix: Date.now() / 1000 + 86400 }) });
    const live = await getExchangeRate('CNY', 'IDR', true);
    assert.equal(live.rate, 2500);
    assert.equal(live.cached, false);
    globalThis.fetch = async () => { throw Error('offline'); };
    const cached = await getExchangeRate('CNY', 'IDR');
    assert.equal(cached.cached, true);
    const offline = await getExchangeRate('CNY', 'IDR', true);
    assert.equal(offline.rate, 2500);
    assert.equal(offline.updatedAt, live.updatedAt);
    assert.equal(offline.offline, true);
    await assert.rejects(() => getExchangeRate('USD', 'IDR', true), /manual rate/);
    assert.equal((await getExchangeRate('IDR', 'IDR')).rate, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  }
});
