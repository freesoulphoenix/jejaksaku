import { getCurrency } from './currency.js';

export function formatCurrency(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}${getCurrency().symbol} ${absolute.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
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
