import { convertAmount } from '../currency-data';

/**
 * Local-clock date formatting.
 *
 * WHY THIS EXISTS: `new Date('2026-10-06').toISOString().slice(0,10)` parses the
 * date as UTC midnight, then formats it back as UTC — so it is only correct on a
 * machine at UTC+0. This box runs Asia/Jakarta (UTC+7), where local midnight is
 * 17:00 the PREVIOUS UTC day, so `toISOString()` returns YESTERDAY. That class
 * of bug already shipped once in this repo (every period labelled one day early)
 * and it is the reason this file exists rather than an inline `toISOString()`.
 *
 * Everything that round-trips a calendar date on this surface uses these two
 * helpers, so parse and format always agree on which clock they mean.
 */

/** `Date` -> 'YYYY-MM-DD' in LOCAL time. */
export function fmtLocalDate(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' -> `Date` at LOCAL midnight. */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Monday of the ISO week containing `dateStr`, as 'YYYY-MM-DD' local.
 * `toISOString()` is deliberately NOT used — see the note above.
 */
export function isoWeekStartLocal(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return fmtLocalDate(d);
}

/** 'DD/M' label for a week start — no year, because a chart axis has no room. */
export function shortDayMonth(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** 'YYYY-MM' -> 'Mon', for the monthly axis. */
export function shortMonth(monthKey: string): string {
  const d = parseLocalDate(`${monthKey}-01`);
  if (isNaN(d.getTime())) return monthKey;
  return d.toLocaleDateString('en-US', { month: 'short' });
}

/* ── Net worth series ───────────────────────────────────────────────────────
   ONE implementation, used by BOTH the dashboard hero chart and the Charts
   tab. These two surfaces previously computed it independently, which is
   precisely how a page ends up showing two different "net worth" trends for the
   same account set. If you change the derivation, it changes in both. */

export interface SeriesPoint { month: string; value: number; }

interface SeriesWallet {
  type: string;
  balance?: number;
  initial_balance?: number;
  currency?: string;
}

interface SeriesTxn {
  date: string;
  type: string;
  amount: number;
  fee?: number;
  is_adjustment?: number | boolean;
}

/** Signed contribution of one transaction to a running balance. */
function signedAmount(t: SeriesTxn): number {
  if (t.type === 'income') return Math.abs(t.amount);
  if (t.type === 'expense') return -Math.abs(t.amount);
  // Only a transfer FEE is a real loss of value. The transferred principal just
  // moves between two wallets the user already owns, so counting it would
  // double-subtract on every transfer.
  if (t.type === 'transfer') return -(t.fee || 0);
  return 0;
}

export type SeriesPeriod = 'day' | 'month';

export function buildNetWorthSeries(opts: {
  transactions: SeriesTxn[];
  wallets: SeriesWallet[];
  baseCurrency: string;
  displayCurrency: string;
  period?: SeriesPeriod;
}): SeriesPoint[] {
  const { transactions, wallets, baseCurrency, displayCurrency, period = 'day' } = opts;

  // Seed with the balances the wallets started from, so the series has a real
  // y-origin instead of beginning at the first transaction's post-balance.
  const startingBalance = wallets.reduce((sum, w) => {
    const initial =
      w.type === 'crypto' || w.type === 'investment'
        ? w.balance || 0      // available fiat leg for a crypto wallet
        : w.initial_balance || 0;
    return sum + convertAmount(initial, w.currency || baseCurrency, displayCurrency);
  }, 0);

  // 'YYYY-MM-DD' keys sort correctly with a plain string compare, which is why
  // this never touches Date for the ordering step.
  const dayMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_adjustment) continue; // historical back-dated rows, not real moves
    const converted = convertAmount(signedAmount(t), baseCurrency, displayCurrency);
    dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + converted);
  }

  const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return [];

  let run = startingBalance;
  const daily: SeriesPoint[] = [];
  for (const [date, net] of sorted) {
    run += net;
    daily.push({ month: date, value: run });
  }

  if (period === 'day') return daily;

  // Month bucketing keeps the LAST value of each month — a month-end balance is
  // the meaningful number, not a mid-month one.
  const monthMap = new Map<string, number>();
  for (const point of daily) {
    monthMap.set(point.month.slice(0, 7), point.value);
  }
  return [...monthMap.entries()].map(([month, value]) => ({ month, value }));
}