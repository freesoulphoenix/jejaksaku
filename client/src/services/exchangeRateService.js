const cacheKey = 'jejaksaku_exchange_rates_v1';

export function getCachedRates(base) {
  try { return JSON.parse(localStorage.getItem(cacheKey) || '{}')[base] || null; }
  catch { return null; }
}

export async function fetchRates(base, refresh = false) {
  const cached = getCachedRates(base);
  if (!refresh && cached && Date.now() < cached.nextUpdate) return { ...cached, cached: true };
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Exchange-rate provider unavailable.');
    const data = await response.json();
    if (data.result !== 'success' || !data.rates || data.base_code !== base) throw new Error('Invalid exchange-rate response.');
    const entry = { rates: data.rates, updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(), nextUpdate: data.time_next_update_unix * 1000 };
    try {
      const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      localStorage.setItem(cacheKey, JSON.stringify({ ...cache, [base]: entry }));
    } catch { /* Rates remain usable when browser storage is full. */ }
    return { ...entry, cached: false };
  } catch (error) {
    if (cached) return { ...cached, cached: true, offline: true };
    throw new Error('No rate available. Connect to the internet or enter a manual rate.');
  }
}

export async function getExchangeRate(from, to, refresh = false) {
  if (from === to) return { rate: 1, updatedAt: null };
  const data = await fetchRates(from, refresh);
  const rate = Number(data.rates[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No rate available for ${to}.`);
  return { ...data, rate };
}
