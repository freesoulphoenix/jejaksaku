import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatementFile } from './statementParserService.js';

test('CSV preserves purchase and posting dates and legitimate identical source rows', async () => {
  const text = 'Posting Date,Transaction Date,Description,Debit\n28/05/2026,27/05/2026,RANCH MARKET,113200\n28/05/2026,27/05/2026,RANCH MARKET,113200';
  const rows = await parseStatementFile({ name: 'statement.csv', text: async () => text }, 'Mega CC');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].transaction_date, '2026-05-27');
  assert.equal(rows[0].posting_date, '2026-05-28');
  assert.equal(rows[0].amount, 113200);
  assert.notEqual(rows[0].source_row_number, rows[1].source_row_number);
});
