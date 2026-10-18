import { resolveMoneyDirection } from './transactionDirection.js';

export function purchaseSources(row) {
  if (row.source_kind) return [row.source_kind];
  const sources = [];
  if (row.receipt_id) sources.push('receipt');
  if (row.imported_transaction_id || row.statement_import_id) sources.push('statement');
  return sources.length ? sources : ['manual'];
}

export function purchaseSourceLabel(row) {
  return purchaseSources(row).map((source) => ({ receipt: 'Receipt scan', statement: 'Statement import', manual: 'Manual input' })[source]).join(' + ');
}

export function purchaseValue(row) {
  return {
    amount: Math.abs(Number(row.original_amount ?? row.amount)),
    currency: row.original_currency || row.primary_currency || 'IDR'
  };
}

export function similarMerchant(first, second) {
  const tokens = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((word) => word.length > 2 && !['jakarta', 'indonesia', 'idn', 'slt', 'mall', 'pos', 'debit', 'qris'].includes(word));
  const a = tokens(first), b = tokens(second);
  const shared = a.filter((word) => b.includes(word));
  return shared.length >= 2 || (shared.length === 1 && Math.min(a.length, b.length) === 1);
}

export function purchaseMatch(first, second) {
  if (first.id && first.id === second.id) return null;
  if (first.transaction_type === 'transfer' || second.transaction_type === 'transfer') return null;
  if (resolveMoneyDirection(first) !== resolveMoneyDirection(second)) return null;
  const a = purchaseValue(first), b = purchaseValue(second);
  if (!Number.isFinite(a.amount) || a.amount <= 0 || a.currency !== b.currency || Math.abs(a.amount - b.amount) >= 0.005) return null;
  if (first.account_id && second.account_id && first.account_id !== second.account_id) return null;
  const sourcesA = purchaseSources(first), sourcesB = purchaseSources(second);
  if (sourcesA.some((source) => sourcesB.includes(source))) return null;
  const days = Math.abs(Date.parse(first.transaction_date) - Date.parse(second.transaction_date)) / 86400000;
  if (!Number.isFinite(days) || days > 3) return null;
  const merchant = similarMerchant(first.receipt?.merchant_name || first.clean_description || first.description, second.receipt?.merchant_name || second.clean_description || second.description);
  // A nearby date alone must never flag an everyday repeat purchase.
  // Only an explicitly supplied posting date establishes the date difference.
  if (days && !(merchant && (first.posting_date || second.posting_date) && (sourcesA.includes('statement') || sourcesB.includes('statement')))) return null;
  const accountKnown = Boolean(first.account_id && second.account_id);
  return {
    confidence: days === 0 && accountKnown ? 'Strong possible match' : 'Possible match',
    reason: `${days ? 'Nearby posting date' : 'Same purchase date'}, amount and currency${accountKnown ? ', and account' : '; account needs confirmation'}; recorded through different sources.${merchant ? ' Merchant names are compatible.' : ' Descriptions may differ.'}`
  };
}

export const purchaseConflictFields = [
  ['description', 'Description'], ['category_id', 'Category'], ['project_tag_id', 'Project Tag'], ['notes', 'Notes'], ['financial_activity', 'Activity']
];

export function resolvePurchaseFields(first, second, choices = {}) {
  const resolved = {};
  for (const [key] of purchaseConflictFields) {
    const a = first[key] || '', b = second[key] || '';
    if (a && b && a !== b && !['first', 'second'].includes(choices[key])) throw new Error(`Choose which ${key.replaceAll('_', ' ')} to keep.`);
    resolved[key] = choices[key] === 'second' ? b : a || b || null;
  }
  return resolved;
}

export function findPurchasePairs(rows, decisions = []) {
  const ignored = new Set(decisions.map((row) => [row.first_transaction_id, row.second_transaction_id].sort().join(':')));
  const buckets = new Map();
  const pairs = [];
  for (const row of rows) {
    const value = purchaseValue(row);
    const key = `${value.currency}:${value.amount.toFixed(2)}`;
    for (const previous of buckets.get(key) || []) {
      if (ignored.has([previous.id, row.id].sort().join(':'))) continue;
      const match = purchaseMatch(previous, row);
      if (match) pairs.push({ first: previous, second: row, ...match });
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return pairs;
}
