const supportedBanks = ['BCA', 'Mandiri', 'BRI', 'BNI', 'Jago', 'GoPay', 'OVO', 'ShopeePay', 'DANA', 'LinkAja', 'Generic PDF', 'CSV', 'XLSX'];

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

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
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

function parseCurrency(value) {
  const cleaned = String(value || '').replace(/[^\d.,-]/g, '');

  if (!cleaned) {
    return 0;
  }

  const negative = cleaned.includes('-');
  const unsigned = cleaned.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const normalized = unsigned
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.');
    return (negative ? -1 : 1) * (Number(normalized) || 0);
  }

  return (negative ? -1 : 1) * (Number(unsigned.replace(/[.,]/g, '')) || 0);
}

function getTransactionTypeFromText(text, amount) {
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
    .replace(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g, '')
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

function normalizeDate(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (iso) {
    return buildValidIsoDate(iso[1], iso[2], iso[3]);
  }

  const local = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);

  if (local) {
    const year = local[3].length === 2 ? `20${local[3]}` : local[3];
    return buildValidIsoDate(year, local[2], local[1]);
  }

  const withoutYear = raw.match(/\b(\d{1,2})[/-](\d{1,2})\b/);

  if (withoutYear) {
    return buildValidIsoDate(new Date().getFullYear(), withoutYear[2], withoutYear[1]);
  }

  return '';
}

function findIndex(headers, candidates) {
  return headers.findIndex((header) => candidates.includes(normalizeHeader(header)));
}

function detectColumns(headers) {
  return {
    date: findIndex(headers, ['date', 'tanggal', 'transactiondate', 'tgl', 'waktu']),
    description: findIndex(headers, ['description', 'keterangan', 'uraian', 'deskripsi', 'merchant', 'remarks', 'transaksi']),
    amount: findIndex(headers, ['amount', 'nominal', 'jumlah', 'mutasi', 'transactionamount']),
    debit: findIndex(headers, ['debit', 'withdrawal', 'pengeluaran']),
    credit: findIndex(headers, ['credit', 'deposit', 'pemasukan'])
  };
}

function rowToTransaction(row, columns) {
  const date = normalizeDate(row[columns.date]);
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
    import_status: getInitialImportStatus(rawDescription, amount, date)
  };
}

function parseRowsFromMatrix(rows) {
  const headerIndex = rows.findIndex((row) => {
    const columns = detectColumns(row);
    return columns.date >= 0 && columns.description >= 0 && (columns.amount >= 0 || columns.debit >= 0 || columns.credit >= 0);
  });

  if (headerIndex === -1) {
    throw new Error('Could not detect date, description, and amount columns in this statement.');
  }

  const headers = rows[headerIndex];
  const columns = detectColumns(headers);

  return rows
    .slice(headerIndex + 1)
    .map((row) => rowToTransaction(row, columns))
    .filter(Boolean);
}

async function parseCsvFile(file) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(splitCsvLine);

  return parseRowsFromMatrix(rows);
}

async function parseXlsxFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    blankrows: false,
    defval: '',
    header: 1
  });

  return parseRowsFromMatrix(rows.map((row) => row.map(String)));
}

function parseLineStatement(lines) {
  return lines.map((line) => {
    const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2})\b/);

    if (!dateMatch) {
      return null;
    }

    const lineWithoutDate = line.replace(dateMatch[0], ' ');
    const amountMatches = lineWithoutDate.match(/-?(?:rp\s*)?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\b/gi) || [];
    const amountMatch = amountMatches
      .filter((match) => Math.abs(parseCurrency(match)) > 0)
      .pop();

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
      import_status: getInitialImportStatus(description, amount, normalizeDate(dateMatch[0]))
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
  const pdfjsLib = await import('pdfjs-dist');
  const pdfWorker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
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
  if (!supportedBanks.includes(bankName)) {
    throw new Error('Choose a supported bank before parsing.');
  }

  const fileType = file.name.split('.').pop()?.toLowerCase();

  if (fileType === 'csv') {
    return parseCsvFile(file);
  }

  if (fileType === 'xlsx') {
    return parseXlsxFile(file);
  }

  if (fileType === 'pdf') {
    return parsePdfFile(file);
  }

  throw new Error('Only PDF, CSV, and XLSX statement files are supported.');
}
