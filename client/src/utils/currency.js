const storageKey = 'dompetdaily_currency';

export const supportedCurrencies = [
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai baht' },
  { code: 'PHP', symbol: '₱', name: 'Philippine peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi riyal' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican peso' },
  { code: 'ZAR', symbol: 'R', name: 'South African rand' }
];

export function getCurrency() {
  try {
    const code = localStorage.getItem(storageKey);
    return supportedCurrencies.find((currency) => currency.code === code) || supportedCurrencies[0];
  } catch {
    return supportedCurrencies[0];
  }
}

export function saveCurrency(code) {
  if (!supportedCurrencies.some((currency) => currency.code === code)) {
    throw new Error('Please select a supported currency.');
  }
  localStorage.setItem(storageKey, code);
}
