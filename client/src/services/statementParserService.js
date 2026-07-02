const garbageKeywords = [
  'saldo awal',
  'saldo akhir',
  'tanggal :',
  'tanggal:',
  'mutasi rekening',
  'rekening koran',
  'periode',
  'halaman'
];

const monthNumbers = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  ags: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12
};

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let insideQuote = false;

  for (const character of line) {
    if (character === '"') {
      insideQuote = !insideQuote;
    } else if (character === ',' && !insideQuote) {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ''));
}

function splitDelimitedLine(line) {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => cell.trim());
  }

  if (line.includes(';') && !line.includes(',')) {
    return line.split(';').map((cell) => cell.trim());
  }

  return splitCsvLine(line);
}

function popBankCsvAmount(cells) {
  if (cells.length === 0) {
    return '';
  }

  const lastCell = cells.pop();

  if (String(lastCell || '').trim() === '-') {
    return '-';
  }

  const parts = [String(lastCell || '').trim()];

  while (cells.length > 0) {
    const leadingPart = parts[0].replace(/[()]/g, '').split('.')[0];
    const previousCell = String(cells[cells.length - 1] || '').trim();

    if (!/^\d{1,3}$/.test(previousCell) || !/^\d{3}$/.test(leadingPart)) {
      break;
    }

    parts.unshift(cells.pop().trim());
  }

  return parts.join(',');
}

function repairBankCsvRows(lines) {
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const columns = detectColumns(headers);

  if (
    columns.date < 0
    || columns.description < 0
    || columns.debit < 0
    || columns.credit < 0
    || headers.length !== 5
  ) {
    return [];
  }

  const repairedRows = [headers];

  lines.slice(1).forEach((line) => {
    const cells = splitCsvLine(line);

    if (cells.length <= headers.length) {
      repairedRows.push(cells);
      return;
    }

    const mutableCells = [...cells];
    const balance = popBankCsvAmount(mutableCells);
    const credit = popBankCsvAmount(mutableCells);
    const debit = popBankCsvAmount(mutableCells);
    const date = mutableCells.shift() || '';
    const description = mutableCells.join(', ').trim();

    repairedRows.push([date, description, debit, credit, balance]);
  });

  return repairedRows;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseHtmlTableRows(text) {
  const tableRows = [];
  const rowMatches = String(text || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const cells = [];
    const cellMatches = rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi);

    for (const cellMatch of cellMatches) {
      cells.push(decodeHtmlEntities(cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
    }

    if (cells.some(Boolean)) {
      tableRows.push(cells);
    }
  }

  return tableRows;
}

function isTextSpreadsheetExport(text) {
  const value = String(text || '').slice(0, 4000);
  const nulCount = (value.match(/\u0000/g) || []).length;

  if (/^\s*PK[\u0003\u0005\u0007]/.test(value) || value.includes('[Content_Types].xml')) {
    return false;
  }

  return nulCount < 3 && (
    /<table\b|<tr\b|<html\b/i.test(value)
    || value.includes('\t')
    || value.split(/\r?\n/).some((line) => line.split(';').length >= 3)
  );
}

function parseCurrency(value) {
  const raw = String(value || '');
  const cleaned = raw.replace(/[^\d.,\s()-]/g, '');

  if (!cleaned) {
    return 0;
  }

  const negative = cleaned.includes('-') || /\([^)]*\)/.test(cleaned);
  const unsigned = cleaned.replace(/[-()\s]/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const normalized = unsigned
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.');
    return (negative ? -1 : 1) * (Number(normalized) || 0);
  }

  const separator = lastComma > -1 ? ',' : lastDot > -1 ? '.' : '';

  if (separator) {
    const parts = unsigned.split(separator);

    if (parts.length === 2 && parts[1].length === 2) {
      return (negative ? -1 : 1) * (Number(parts.join('.')) || 0);
    }
  }

  return (negative ? -1 : 1) * (Number(unsigned.replace(/[.,]/g, '')) || 0);
}

function getTransactionTypeFromText(text, amount) {
  if (Number(amount || 0) < 0) {
    return 'expense';
  }

  if (Number(amount || 0) > 0) {
    return 'income';
  }

  const normalized = String(text || '').toLowerCase();

  if (/\bcr\b|credit|kredit|pemasukan|masuk/.test(normalized)) {
    return 'income';
  }

  if (/\bdb\b|debit|debet|withdrawal|pengeluaran|keluar/.test(normalized)) {
    return 'expense';
  }

  return Number(amount || 0) < 0 ? 'expense' : 'income';
}

function cleanDescription(value) {
  return String(value || '')
    .replace(/\b(cr|db)\b/gi, '')
    .replace(/\brp\b/gi, '')
    .replace(/\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?/g, '')
    .replace(/\d+(?:[.,]\d{2})/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getInitialImportStatus(description, amount, date) {
  const normalized = String(description || '').toLowerCase();
  const isGarbage = garbageKeywords.some((keyword) => normalized.includes(keyword));

  if (isGarbage || !description || !amount || !date) {
    return 'needs_review';
  }

  return 'pending';
}

function uniqueRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = [
      row.transaction_date,
      row.clean_description || row.raw_description,
      row.amount,
      row.transaction_type
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getRowsScore(rows) {
  return rows.reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
}

function chooseBestRows(rowGroups) {
  return rowGroups
    .filter((rows) => rows.length > 0)
    .sort((first, second) => (
      getRowsScore(second) - getRowsScore(first)
      || second.length - first.length
    ))[0] || [];
}

function chooseMostRows(rowGroups) {
  return rowGroups
    .filter((rows) => rows.length > 0)
    .sort((first, second) => (
      second.length - first.length
      || getRowsScore(second) - getRowsScore(first)
    ))[0] || [];
}

function buildValidIsoDate(year, month, day) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (
    !numericYear
    || numericMonth < 1
    || numericMonth > 12
    || numericDay < 1
    || numericDay > 31
  ) {
    return '';
  }

  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
  const isValidDate = date.getUTCFullYear() === numericYear
    && date.getUTCMonth() === numericMonth - 1
    && date.getUTCDate() === numericDay;

  if (!isValidDate) {
    return '';
  }

  return `${String(numericYear).padStart(4, '0')}-${String(numericMonth).padStart(2, '0')}-${String(numericDay).padStart(2, '0')}`;
}

function normalizeExcelSerialDate(value) {
  const serial = Number(value);

  if (!Number.isFinite(serial) || serial < 25000 || serial > 70000) {
    return '';
  }

  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + Math.floor(serial));

  return buildValidIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function normalizeDate(value) {
  return normalizeDateWithOrder(value);
}

function normalizeDateWithOrder(value, dateOrder = 'local') {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildValidIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const raw = String(value || '').trim();

  const serialDate = normalizeExcelSerialDate(raw);

  if (serialDate) {
    return serialDate;
  }

  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (iso) {
    return buildValidIsoDate(iso[1], iso[2], iso[3]);
  }

  const local = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);

  if (local) {
    const year = local[3].length === 2 ? `20${local[3]}` : local[3];
    const first = Number(local[1]);
    const second = Number(local[2]);

    if (dateOrder === 'month-first' && first <= 12) {
      return buildValidIsoDate(year, first, second);
    }

    if (second > 12 && first <= 12) {
      return buildValidIsoDate(year, first, second);
    }

    return buildValidIsoDate(year, second, first);
  }

  const withoutYear = raw.match(/\b(\d{1,2})[./-](\d{1,2})\b/);

  if (withoutYear) {
    return buildValidIsoDate(new Date().getFullYear(), withoutYear[2], withoutYear[1]);
  }

  const monthPattern = Object.keys(monthNumbers)
    .sort((first, second) => second.length - first.length)
    .join('|');
  const dayMonthName = raw.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{2,4})\\b`, 'i'));
  const monthNameDay = raw.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{2,4})\\b`, 'i'));

  if (dayMonthName || monthNameDay) {
    const match = dayMonthName || monthNameDay;
    const day = dayMonthName ? match[1] : match[2];
    const month = monthNumbers[(dayMonthName ? match[2] : match[1]).toLowerCase()];
    const year = normalizeYear(match[3]);
    return buildValidIsoDate(year, month, day);
  }

  return '';
}

function normalizeYear(value) {
  return String(value).length === 2 ? `20${value}` : value;
}

function findIndex(headers, candidates) {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const exactIndex = headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));

  if (exactIndex >= 0) {
    return exactIndex;
  }

  return headers.findIndex((header) => {
    const normalizedHeader = normalizeHeader(header);
    if (!normalizedHeader) {
      return false;
    }

    return normalizedCandidates.some((candidate) => (
      normalizedHeader.includes(candidate)
      || candidate.includes(normalizedHeader)
    ));
  });
}

function detectColumns(headers) {
  const debit = findIndex(headers, ['debit', 'debet', 'withdrawal', 'pengeluaran', 'mutasidebet', 'debitamount', 'amountdebit', 'withdrawalamount']);
  const credit = findIndex(headers, ['credit', 'kredit', 'deposit', 'pemasukan', 'mutasikredit', 'creditamount', 'amountcredit', 'depositamount']);
  let amount = findIndex(headers, ['amount', 'nominal', 'jumlah', 'mutasi', 'transactionamount', 'amountidr', 'nominaltransaksi', 'transactionnominal']);

  if (amount === debit || amount === credit) {
    amount = -1;
  }

  return {
    date: findIndex(headers, ['date', 'tanggal', 'transactiondate', 'tanggaltransaksi', 'tgl', 'tgltransaksi', 'waktu', 'postingdate', 'valuedate']),
    description: findIndex(headers, ['description', 'keterangan', 'uraian', 'deskripsi', 'merchant', 'remarks', 'transaksi', 'rinciantransaksi', 'berita', 'narrative', 'transactiondescription', 'details', 'detail', 'reference']),
    amount,
    debit,
    credit
  };
}

function findObjectKey(row, candidates) {
  const keys = Object.keys(row || {});
  const normalizedCandidates = candidates.map(normalizeHeader);
  const exactKey = keys.find((key) => normalizedCandidates.includes(normalizeHeader(key)));

  if (exactKey) {
    return exactKey;
  }

  return keys.find((key) => {
    const normalizedKey = normalizeHeader(key);
    return normalizedKey && normalizedCandidates.some((candidate) => (
      normalizedKey.includes(candidate)
      || candidate.includes(normalizedKey)
    ));
  }) || '';
}

function getDateOrder(header) {
  const normalizedHeader = normalizeHeader(header);

  return normalizedHeader === 'date' || normalizedHeader.includes('postingdate') || normalizedHeader.includes('valuedate')
    ? 'month-first'
    : 'local';
}

function getNumericDateParts(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-]\d{2,4}$/);

  if (!match) {
    return null;
  }

  return {
    first: Number(match[1]),
    second: Number(match[2])
  };
}

function inferObjectRowsDateOrder(rows) {
  for (const row of rows) {
    const dateKey = findObjectKey(row, ['date', 'tanggal', 'transactiondate', 'tanggaltransaksi', 'tgl', 'tgltransaksi', 'postingdate', 'valuedate']);
    const parts = getNumericDateParts(dateKey ? row[dateKey] : '');

    if (!parts) {
      continue;
    }

    if (parts.first > 12 && parts.second <= 12) {
      return 'local';
    }

    if (parts.second > 12 && parts.first <= 12) {
      return 'month-first';
    }
  }

  return '';
}

function objectRowToTransaction(row, dateOrderOverride = '') {
  const dateKey = findObjectKey(row, ['date', 'tanggal', 'transactiondate', 'tanggaltransaksi', 'tgl', 'tgltransaksi', 'postingdate', 'valuedate']);
  const descriptionKey = findObjectKey(row, ['description', 'keterangan', 'uraian', 'deskripsi', 'merchant', 'remarks', 'transaksi', 'rinciantransaksi', 'berita', 'narrative', 'transactiondescription', 'details', 'detail', 'reference']);
  const debitKey = findObjectKey(row, ['debet', 'debit', 'withdrawal', 'pengeluaran', 'mutasidebet', 'debitamount', 'amountdebit', 'withdrawalamount']);
  const creditKey = findObjectKey(row, ['credit', 'kredit', 'deposit', 'pemasukan', 'mutasikredit', 'creditamount', 'amountcredit', 'depositamount']);
  const amountKey = findObjectKey(row, ['amount', 'nominal', 'jumlah', 'mutasi', 'transactionamount', 'amountidr', 'nominaltransaksi', 'transactionnominal']);

  if (!dateKey || !descriptionKey || (!amountKey && !debitKey && !creditKey)) {
    return null;
  }

  const date = normalizeDateWithOrder(row[dateKey], dateOrderOverride || getDateOrder(dateKey));
  const rawDescription = row[descriptionKey] || 'Imported transaction';
  const debit = debitKey ? parseCurrency(row[debitKey]) : 0;
  const credit = creditKey ? parseCurrency(row[creditKey]) : 0;
  const amount = credit > 0
    ? credit
    : debit > 0
      ? -Math.abs(debit)
      : parseCurrency(row[amountKey]);

  if (!date || !amount) {
    return null;
  }

  return {
    transaction_date: date,
    raw_description: rawDescription,
    clean_description: cleanDescription(rawDescription) || rawDescription,
    amount: Math.abs(amount),
    transaction_type: getTransactionTypeFromText(rawDescription, amount),
    import_status: getInitialImportStatus(rawDescription, amount, date),
    source_row_number: row.source_row_number || null
  };
}

function parseObjectRows(rows, dateOrderOverride = '') {
  return rows
    .map((row, index) => objectRowToTransaction({
      ...row,
      source_row_number: row.source_row_number || index + 2
    }, dateOrderOverride))
    .filter(Boolean);
}

function rowToTransaction(row, columns, headers = []) {
  const date = normalizeDateWithOrder(row[columns.date], getDateOrder(headers[columns.date]));
  const rawDescription = row[columns.description] || 'Imported transaction';
  let amount = 0;

  if (columns.amount >= 0) {
    amount = parseCurrency(row[columns.amount]);
  } else {
    const debit = columns.debit >= 0 ? parseCurrency(row[columns.debit]) : 0;
    const credit = columns.credit >= 0 ? parseCurrency(row[columns.credit]) : 0;
    amount = credit > 0 ? credit : -Math.abs(debit);
  }

  if (!date || !amount) {
    return null;
  }

  return {
    transaction_date: date,
    raw_description: rawDescription,
    clean_description: cleanDescription(rawDescription) || rawDescription,
    amount: Math.abs(amount),
    transaction_type: getTransactionTypeFromText(rawDescription, amount),
    import_status: getInitialImportStatus(rawDescription, amount, date),
    source_row_number: row.source_row_number || null
  };
}

function parseRowsFromMatrix(rows) {
  const normalizedRows = rows.map((row) => row.map((cell) => (
    cell instanceof Date ? normalizeDate(cell) : String(cell ?? '').trim()
  )));
  const lineFallbackRows = parseLineStatement(normalizedRows.map((row) => row.filter(Boolean).join(' ')));
  const headerIndex = normalizedRows.findIndex((row) => {
    const columns = detectColumns(row);
    return columns.date >= 0 && columns.description >= 0 && (columns.amount >= 0 || columns.debit >= 0 || columns.credit >= 0);
  });

  if (headerIndex === -1) {
    if (lineFallbackRows.length > 0) {
      return lineFallbackRows;
    }

    throw new Error('Could not detect date, description, and amount columns in this statement.');
  }

  const headers = normalizedRows[headerIndex];
  const columns = detectColumns(headers);

  const parsedRows = normalizedRows
    .slice(headerIndex + 1)
    .map((row, index) => rowToTransaction({
      ...row,
      source_row_number: headerIndex + index + 2
    }, columns, headers))
    .filter(Boolean);

  if (parsedRows.length === 0) {
    return lineFallbackRows;
  }

  if (lineFallbackRows.length > parsedRows.length) {
    return lineFallbackRows;
  }

  return parsedRows;
}

async function parseCsvFile(file) {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .filter(Boolean);
  const rows = lines.map(splitDelimitedLine);
  const parsedRowGroups = [];

  try {
    parsedRowGroups.push(parseRowsFromMatrix(repairBankCsvRows(lines)));
  } catch (error) {
    // Keep the standard parser as the fallback below.
  }

  try {
    parsedRowGroups.push(parseRowsFromMatrix(rows));
  } catch (error) {
    if (parsedRowGroups.length === 0) {
      throw error;
    }
  }

  const bestRows = uniqueRows(chooseBestRows(parsedRowGroups));

  if (bestRows.length === 0) {
    throw new Error('Could not detect date, description, and amount columns in this statement.');
  }

  return bestRows;
}

async function parseXlsxFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const parsedRowGroups = [];
  const parseErrors = [];
  const workbooks = [];
  const binaryData = new Uint8Array(buffer);

  [
    () => XLSX.read(binaryData, { cellDates: false, type: 'array' }),
    () => XLSX.read(buffer, { cellDates: true, type: 'array' }),
    () => XLSX.read(buffer, { cellDates: false, type: 'array' })
  ].forEach((readWorkbook) => {
    try {
      const workbook = readWorkbook();

      if (workbook?.SheetNames?.length) {
        workbooks.push(workbook);
      }
    } catch (error) {
      parseErrors.push(error);
    }
  });

  workbooks.forEach((workbook) => {
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const displayedObjectRows = XLSX.utils.sheet_to_json(worksheet, {
        blankrows: false,
        defval: '',
        raw: false
      });

      try {
        const parsedDisplayedRows = parseObjectRows(
          displayedObjectRows,
          inferObjectRowsDateOrder(displayedObjectRows)
        );

        if (parsedDisplayedRows.length > 0) {
          parsedRowGroups.push(parsedDisplayedRows);
        }
      } catch (error) {
        parseErrors.push(error);
      }
    });
  });

  const displayedRows = chooseMostRows(parsedRowGroups);

  if (displayedRows.length > 0) {
    return displayedRows;
  }

  workbooks.forEach((workbook) => {
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];

      [
        { raw: true },
      ].forEach(({ raw }) => {
        const objectRows = XLSX.utils.sheet_to_json(worksheet, {
          blankrows: false,
          defval: '',
          raw
        });

        try {
          const parsedObjectRows = parseObjectRows(objectRows);

          if (parsedObjectRows.length > 0) {
            parsedRowGroups.push(parsedObjectRows);
          }
        } catch (error) {
          parseErrors.push(error);
        }
      });

      [
        { raw: true },
        { raw: false }
      ].forEach(({ raw }) => {
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          blankrows: false,
          defval: '',
          header: 1,
          raw
        });

        try {
          parsedRowGroups.push(parseRowsFromMatrix(rows));
        } catch (error) {
          parseErrors.push(error);
        }
      });
    });
  });

  let text = '';
  let textSpreadsheetExport = false;

  try {
    text = await file.text();
    textSpreadsheetExport = isTextSpreadsheetExport(text);
  } catch (error) {
    parseErrors.push(error);
  }

  if (textSpreadsheetExport) {
    try {
      const htmlRows = parseHtmlTableRows(text);

      if (htmlRows.length > 0) {
        parsedRowGroups.push(parseRowsFromMatrix(htmlRows));
      }
    } catch (error) {
      parseErrors.push(error);
    }

    try {
      const textRows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map(splitDelimitedLine);
      parsedRowGroups.push(parseRowsFromMatrix(textRows));
    } catch (error) {
      parseErrors.push(error);
    }
  }

  const bestRows = uniqueRows(chooseBestRows(parsedRowGroups));

  if (bestRows.length > 0) {
    return bestRows;
  }

  throw parseErrors[0] || new Error('Could not extract transaction rows from this spreadsheet.');
}

function parseLineStatement(lines) {
  return lines.map((line, index) => {
    const monthPattern = Object.keys(monthNumbers)
      .sort((first, second) => second.length - first.length)
      .join('|');
    const dateMatch = line.match(new RegExp(`\\b(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[./-]\\d{1,2}|\\d{1,2}\\s+(?:${monthPattern})\\s+\\d{2,4}|(?:${monthPattern})\\s+\\d{1,2},?\\s+\\d{2,4})\\b`, 'i'));

    if (!dateMatch) {
      return null;
    }

    const lineWithoutDate = line.replace(dateMatch[0], ' ');
    const amountMatches = lineWithoutDate.match(/-?\(?(?:rp\s*)?(?:\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\)?\b/gi) || [];
    const usableAmountMatches = amountMatches.filter((match) => Math.abs(parseCurrency(match)) > 0);
    const explicitDirectionAmount = usableAmountMatches.find((match) => {
      const escapedMatch = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`${escapedMatch}\\s*(?:cr|credit|kredit|db|debit|debet)\\b|\\b(?:cr|credit|kredit|db|debit|debet)\\s*${escapedMatch}`, 'i').test(lineWithoutDate);
    });
    const amountMatch = explicitDirectionAmount || usableAmountMatches[0];

    if (!amountMatch) {
      return null;
    }

    const description = line
      .replace(dateMatch[0], '')
      .replace(amountMatch, '')
      .replace(/\s+/g, ' ')
      .trim();
    const amount = parseCurrency(amountMatch);

    return {
      transaction_date: normalizeDate(dateMatch[0]),
      raw_description: line,
      clean_description: cleanDescription(description) || description || 'Imported transaction',
      amount: Math.abs(amount),
      transaction_type: getTransactionTypeFromText(line, amount),
      import_status: getInitialImportStatus(description, amount, normalizeDate(dateMatch[0])),
      source_row_number: index + 1
    };
  }).filter((row) => row?.transaction_date && row.amount);
}

function getPdfTextLines(items) {
  const rowMap = new Map();

  items.forEach((item) => {
    if (!item.str?.trim()) {
      return;
    }

    const x = item.transform?.[4] || 0;
    const y = item.transform?.[5] || 0;
    const rowKey = Math.round(y / 3) * 3;
    const row = rowMap.get(rowKey) || [];
    row.push({
      text: item.str.trim(),
      x
    });
    rowMap.set(rowKey, row);
  });

  return [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
}

async function renderPdfPageToImage(page) {
  if (typeof document === 'undefined') {
    throw new Error('PDF OCR fallback requires a browser environment.');
  }

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL('image/png');
}

async function ocrPdfLines(pdf) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const lines = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const image = await renderPdfPageToImage(page);
      const result = await worker.recognize(image);
      lines.push(...result.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }
  } finally {
    await worker.terminate();
  }

  return lines;
}

async function parsePdfFile(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...getPdfTextLines(content.items));
  }

  let parsedRows = parseLineStatement(lines);

  if (parsedRows.length === 0) {
    const ocrLines = await ocrPdfLines(pdf);
    parsedRows = parseLineStatement(ocrLines);
  }

  if (parsedRows.length === 0) {
    throw new Error('Could not extract transaction rows from this PDF. Try CSV/XLSX export if this bank statement uses a complex layout.');
  }

  return parsedRows;
}

export async function parseStatementFile(file, bankName) {
  if (!bankName) {
    throw new Error('Choose a source account before parsing.');
  }

  const fileType = file.name.split('.').pop()?.toLowerCase();

  if (fileType === 'csv') {
    return parseCsvFile(file);
  }

  if (fileType === 'xlsx' || fileType === 'xls') {
    return parseXlsxFile(file);
  }

  if (fileType === 'pdf') {
    return parsePdfFile(file);
  }

  throw new Error('Only PDF, CSV, and XLSX statement files are supported.');
}
