import { getCurrency } from './currency.js';

export function formatCurrency(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(value));
  return `${sign}${getCurrency().symbol} ${absolute.toLocaleString('id-ID')}`;
}

export function parseCurrencyInput(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  return Number(digits || 0);
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
