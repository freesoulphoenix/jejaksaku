import { createWorker } from 'tesseract.js';
import { updateReceiptReview, updateReceiptStatus } from './receiptService.js';

function getCleanLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCurrencyValue(value) {
  if (!value) {
    return 0;
  }

  const cleaned = value.replace(/[^\d.,]/g, '');

  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const normalized = cleaned
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.');
    return Number(normalized) || 0;
  }

  const separator = lastComma > -1 ? ',' : '.';
  const parts = cleaned.split(separator);
  const lastPart = parts[parts.length - 1];

  if (parts.length > 1 && lastPart.length === 2) {
    return Number(cleaned.replace(separator, '.').replace(/[,.](?=.*[,.])/g, '')) || 0;
  }

  return Number(cleaned.replace(/[.,]/g, '')) || 0;
}

function extractTotal(lines) {
  const totalKeywords = ['grand total', 'total', 'amount', 'jumlah', 'subtotal'];
  const numberPattern = /(?:rp\s*)?[\d.,]+/gi;
  const candidates = [];

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();
    const hasTotalKeyword = totalKeywords.some((keyword) => lowerLine.includes(keyword));
    const matches = line.match(numberPattern) || [];

    matches.forEach((match) => {
      const amount = parseCurrencyValue(match);

      if (amount > 0) {
        candidates.push({
          amount,
          score: hasTotalKeyword ? 2 : 1
        });
      }
    });
  });

  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return candidates[0]?.amount || 0;
}

function extractDate(lines) {
  const text = lines.join(' ');
  const numericDate = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);

  if (numericDate) {
    const day = numericDate[1].padStart(2, '0');
    const month = numericDate[2].padStart(2, '0');
    const year = numericDate[3].length === 2 ? `20${numericDate[3]}` : numericDate[3];
    return `${year}-${month}-${day}`;
  }

  const isoDate = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}`;
  }

  const monthNumbers = {
    jan: 1,
    january: 1,
    januari: 1,
    feb: 2,
    february: 2,
    februari: 2,
    mar: 3,
    march: 3,
    maret: 3,
    apr: 4,
    april: 4,
    may: 5,
    mei: 5,
    jun: 6,
    june: 6,
    juni: 6,
    jul: 7,
    july: 7,
    juli: 7,
    aug: 8,
    august: 8,
    agustus: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    oktober: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
    desember: 12
  };
  const monthPattern = Object.keys(monthNumbers)
    .sort((first, second) => second.length - first.length)
    .join('|');
  const dayFirstDate = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));
  const monthFirstDate = text.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));

  if (dayFirstDate || monthFirstDate) {
    const match = dayFirstDate || monthFirstDate;
    const day = (dayFirstDate ? match[1] : match[2]).padStart(2, '0');
    const monthName = (dayFirstDate ? match[2] : match[1]).toLowerCase();
    const month = String(monthNumbers[monthName]).padStart(2, '0');
    const rawYear = match[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function extractMerchant(lines) {
  const ignoredWords = ['receipt', 'invoice', 'struk', 'nota', 'date', 'tanggal', 'total', 'cashier'];

  return lines.find((line) => {
    const lowerLine = line.toLowerCase();
    const hasLetters = /[a-z]/i.test(line);
    const isMostlyNumbers = line.replace(/\D/g, '').length > line.length / 2;
    const isIgnored = ignoredWords.some((word) => lowerLine.includes(word));

    return hasLetters && !isMostlyNumbers && !isIgnored;
  }) || '';
}

export function extractReceiptFields(text) {
  const lines = getCleanLines(text);

  return {
    merchant_name: extractMerchant(lines),
    receipt_date: extractDate(lines),
    total_amount: extractTotal(lines)
  };
}

export async function runReceiptOcr(receipt) {
  await updateReceiptStatus(receipt.id, 'processing');

  let worker;

  try {
    worker = await createWorker('eng');
    const result = await worker.recognize(receipt.image_url);
    const extracted = extractReceiptFields(result.data.text || '');

    if (!extracted.merchant_name && !extracted.receipt_date && !extracted.total_amount) {
      throw new Error('No usable OCR values were found. You can still enter receipt details manually.');
    }

    const updatedReceipt = await updateReceiptReview(receipt.id, {
      merchant_name: extracted.merchant_name || receipt.merchant_name || '',
      receipt_date: extracted.receipt_date || '',
      total_amount: extracted.total_amount || receipt.total_amount || 0,
      processing_status: 'completed'
    });

    return {
      ...updatedReceipt,
      ocr_text: result.data.text || ''
    };
  } catch (error) {
    await updateReceiptStatus(receipt.id, 'failed');
    throw error;
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
