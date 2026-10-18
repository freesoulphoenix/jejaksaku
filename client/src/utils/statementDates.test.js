import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStatementDateColumns } from './statementDates.js';

test('purchase date takes priority over posting date regardless of column order', () => {
  assert.deepEqual(detectStatementDateColumns(['Posting Date', 'Description', 'Transaction Date']), { date: 2, posting: 0 });
  assert.deepEqual(detectStatementDateColumns(['Tanggal Pembukuan', 'Tanggal Transaksi']), { date: 1, posting: 0 });
});
test('posting-only statements retain evidence that their date is a posting date', () => {
  assert.deepEqual(detectStatementDateColumns(['Posting Date', 'Amount']), { date: 0, posting: 0 });
  assert.deepEqual(detectStatementDateColumns(['Date', 'Amount']), { date: 0, posting: -1 });
});
