import { getCurrency, getCurrencyFormat, supportedCurrencies } from './currency.js';

export function formatCurrency(value, code = getCurrency().code) {
  if (value == null || !Number.isFinite(Number(value))) return 'Rate unavailable';
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const { position, decimals } = getCurrencyFormat(code);
  const symbol = supportedCurrencies.find((currency) => currency.code === code)?.symbol || code;
  const number = absolute.toLocaleString('en-US', {
    minimumFractionDigits: Number(decimals), maximumFractionDigits: Number(decimals)
  });
  return position === 'end' ? `${sign}${number} ${symbol}` : `${sign}${symbol} ${number}`;
}

export function parseCurrencyInput(value) {
  if (typeof value === 'number') return value;
  // Match the separators used by formatCurrency: 1,234.56.
  const normalized = String(value || '').replace(/[^\d.-]/g, '');
  return Number(normalized || 0);
}

export function formatShortCurrency(value) {
  const { symbol } = getCurrency();
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${sign}${symbol} ${(absolute / 1_000_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}${symbol} ${(absolute / 1_000_000).toFixed(1)}jt`;
  }

  if (absolute >= 1_000) {
    return `${sign}${symbol} ${(absolute / 1_000).toFixed(0)}rb`;
  }

  return `${sign}${symbol} ${absolute}`;
}
