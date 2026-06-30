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

function normalizeOcrText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'l')
    .replace(/[4@]/g, 'a')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrencyMatches(line) {
  return line.match(/(?:rp\s*)?\d[\d.,]*/gi) || [];
}

function isLikelyReceiptAmount(amount) {
  return amount >= 100;
}

function hasTotalKeyword(line) {
  const normalizedLine = normalizeOcrText(line);

  return /\b(grand\s+total|total|totai|totl|tota|jumlah|jurnlah)\b/.test(normalizedLine);
}

function hasPaymentKeyword(line) {
  const normalizedLine = normalizeOcrText(line);

  return /\b(cash|tunai|debit|credit|kartu|card|visa|mastercard|bca|mandiri|bni|bri|qris|gopay|ovo|dana|shopeepay)\b/.test(normalizedLine);
}

function isIgnoredTotalLine(line) {
  const normalizedLine = normalizeOcrText(line);

  return /\b(total\s*item|item|items|qty|quantity|jumlah\s*barang|discount|disc|diskon|saving|change|kembali|tax|pajak|ppn|pb1|stamp|st[a4]mp)\b/.test(normalizedLine);
}

function addAmountCandidates(candidates, line, index, score) {
  getCurrencyMatches(line).forEach((match) => {
    const amount = parseCurrencyValue(match);

    if (isLikelyReceiptAmount(amount)) {
      candidates.push({
        amount,
        index,
        score
      });
    }
  });
}

function extractTotal(lines) {
  const candidates = [];

  lines.forEach((line, index) => {
    const hasTotal = hasTotalKeyword(line);
    const hasPayment = hasPaymentKeyword(line);
    const ignored = isIgnoredTotalLine(line);
    const positionScore = index / Math.max(lines.length - 1, 1);

    if (hasTotal && !ignored) {
      addAmountCandidates(candidates, line, index, 80 + positionScore);

      if (getCurrencyMatches(line).length === 0) {
        addAmountCandidates(candidates, lines[index + 1] || '', index + 1, 72 + positionScore);
        addAmountCandidates(candidates, lines[index + 2] || '', index + 2, 64 + positionScore);
      }

      return;
    }

    if (hasPayment && !ignored) {
      addAmountCandidates(candidates, line, index, 44 + positionScore);
      return;
    }

    if (!ignored && index > lines.length * 0.45) {
      addAmountCandidates(candidates, line, index, 18 + positionScore);
    }
  });

  candidates.sort((a, b) => (
    b.score - a.score
    || b.index - a.index
    || b.amount - a.amount
  ));
  return candidates[0]?.amount || 0;
}

function normalizeYear(value) {
  return value.length === 2 ? `20${value}` : value;
}

function isValidDateParts(year, month, day) {
  const currentYear = new Date().getFullYear();
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  if (numericYear < 2000 || numericYear > currentYear || numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) {
    return false;
  }

  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
  return date.getUTCFullYear() === numericYear
    && date.getUTCMonth() === numericMonth - 1
    && date.getUTCDate() === numericDay;
}

function formatDateParts(year, month, day) {
  if (!isValidDateParts(year, month, day)) {
    return '';
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseNumericReceiptDate(first, second, rawYear) {
  const year = normalizeYear(rawYear);
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  let day = first;
  let month = second;

  if (firstNumber <= 12 && secondNumber > 12) {
    month = first;
    day = second;
  }

  return formatDateParts(year, month, day);
}

function extractDate(lines) {
  const text = lines.join(' ');
  const numericDate = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);

  if (numericDate) {
    const date = parseNumericReceiptDate(numericDate[1], numericDate[2], numericDate[3]);

    if (date) {
      return date;
    }
  }

  const isoDate = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (isoDate) {
    return formatDateParts(isoDate[1], isoDate[2], isoDate[3]);
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
  const dateLabelPattern = '(?:waktu|tanggal|tgl|date|transaction\\s*time|jam|printed|cetak)';
  const labeledDayFirstDate = text.match(new RegExp(`\\b${dateLabelPattern}\\b\\s*[:\\-]?\\s*(\\d{1,2})\\s+(${monthPattern})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));
  const labeledMonthFirstDate = text.match(new RegExp(`\\b${dateLabelPattern}\\b\\s*[:\\-]?\\s*(${monthPattern})\\s+(\\d{1,2})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));
  const dayFirstDate = labeledDayFirstDate || text.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));
  const monthFirstDate = labeledMonthFirstDate || text.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})\\s*,?\\s*(\\d{2,4})\\b`, 'i'));

  if (dayFirstDate || monthFirstDate) {
    const match = dayFirstDate || monthFirstDate;
    const day = (dayFirstDate ? match[1] : match[2]).padStart(2, '0');
    const monthName = (dayFirstDate ? match[2] : match[1]).toLowerCase();
    const month = String(monthNumbers[monthName]).padStart(2, '0');
    const year = normalizeYear(match[3]);
    return formatDateParts(year, month, day);
  }

  return '';
}

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function preprocessImageForOcr(image) {
  const maxLongEdge = 2200;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(2, Math.max(1, maxLongEdge / Math.max(sourceWidth, sourceHeight)));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    const contrasted = Math.max(0, Math.min(255, ((gray - 128) * 1.45) + 142));
    const lifted = contrasted < 170 ? Math.max(0, contrasted - 18) : Math.min(255, contrasted + 18);
    data[index] = lifted;
    data[index + 1] = lifted;
    data[index + 2] = lifted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function getOcrImageSource(imageUrl) {
  if (typeof document === 'undefined' || !imageUrl || /\.pdf($|\?)/i.test(imageUrl)) {
    return imageUrl;
  }

  try {
    const image = await loadImage(imageUrl);
    return preprocessImageForOcr(image);
  } catch (error) {
    return imageUrl;
  }
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
    const imageSource = await getOcrImageSource(receipt.image_url);
    const result = await worker.recognize(imageSource);
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
