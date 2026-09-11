export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
];

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 151.50,
  CNY: 7.24,
  IDR: 16250,
  SGD: 1.35,
  KRW: 1375,
  INR: 83.50,
  AUD: 1.53,
  CAD: 1.37,
  CHF: 0.91,
  MYR: 4.72,
  PHP: 58.50,
  THB: 36.80,
  VND: 25450,
  BRL: 5.15,
};

// Live rates cache with staleness tracking
let liveRates: Record<string, number> | null = null;
let liveRatesFetchedAt = 0;
const RATES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchLiveRates(): Promise<Record<string, number>> {
  if (liveRates && Date.now() - liveRatesFetchedAt < RATES_CACHE_TTL) {
    return liveRates;
  }
  try {
    const codes = Object.keys(EXCHANGE_RATES).join(',');
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.rates) {
      liveRates = { USD: 1 };
      for (const [code, rate] of Object.entries(data.rates)) {
        if (EXCHANGE_RATES[code] !== undefined) {
          liveRates[code] = rate as number;
        }
      }
      liveRatesFetchedAt = Date.now();
    }
  } catch { /* fall back to static rates */ }
  return liveRates || EXCHANGE_RATES;
}

export function getEffectiveRates(): Record<string, number> {
  return liveRates || EXCHANGE_RATES;
}

export function isRatesStale(): boolean {
  return !liveRates || Date.now() - liveRatesFetchedAt > RATES_CACHE_TTL;
}

const currencySymbolCache = new Map<string, CurrencyInfo>();
for (const c of CURRENCIES) currencySymbolCache.set(c.code, c);

export function getCurrencyInfo(code: string): CurrencyInfo {
  return currencySymbolCache.get(code) || currencySymbolCache.get('USD')!;
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  const rates = getEffectiveRates();
  const usdAmount = amount / (rates[fromCurrency] || 1);
  return usdAmount * (rates[toCurrency] || 1);
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const info = getCurrencyInfo(currencyCode);
  const sign = amount >= 0 ? '' : '-';
  const abs = Math.abs(amount);

  if (currencyCode === 'IDR' || currencyCode === 'VND' || currencyCode === 'KRW' || currencyCode === 'JPY') {
    return `${sign}${info.symbol}${Math.round(abs).toLocaleString(info.locale)}`;
  }

  return `${sign}${info.symbol}${abs.toLocaleString(info.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPrice(amount: number, currencyCode: string = 'USD'): string {
  const info = getCurrencyInfo(currencyCode);
  const sign = amount >= 0 ? '' : '-';
  const abs = Math.abs(amount);

  if (currencyCode === 'IDR' || currencyCode === 'VND' || currencyCode === 'KRW' || currencyCode === 'JPY') {
    return `${sign}${info.symbol}${Math.round(abs).toLocaleString(info.locale)}`;
  }

  let decimals: number;
  if (abs === 0) decimals = 2;
  else if (abs < 0.0001) decimals = 8;
  else if (abs < 1) decimals = 6;
  else if (abs < 100) decimals = 4;
  else decimals = 2;

  return `${sign}${info.symbol}${abs.toLocaleString(info.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs === 0) return '0';
  if (abs < 0.0001) return amount.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
  if (abs < 1) return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export const COMMON_CURRENCIES = ['USD', 'IDR', 'SGD', 'GBP', 'EUR', 'JPY', 'AUD', 'CNY', 'KRW', 'INR'];
