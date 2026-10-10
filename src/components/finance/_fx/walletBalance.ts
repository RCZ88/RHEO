import type { FinanceWallet } from '../finance-types';

/**
 * walletBalance — ONE derivation of "how much is in this wallet".
 *
 * WHY THIS FILE EXISTS: the same question was answered in two places that
 * disagreed.
 *  - `FinancePage`'s net-worth `useMemo` parsed `metadata` defensively
 *    (try/JSON.parse) and handled denominations as BOTH an array and a record.
 *  - The Overview accounts card did `w.metadata?.denominations`, but
 *    `FinanceWallet.metadata` is typed `string | null` — so that read a property
 *    off a STRING, which is always `undefined`, and the denomination branch
 *    silently never ran. A cash/physical wallet showed `w.balance` while the
 *    header showed the counted denominations. Two numbers, one wallet, no
 *    error anywhere.
 *
 * Two surfaces showing the same number must have ONE field and ONE formatter.
 * Now they do.
 */

type Denominations =
  | Record<string, number>
  | Array<{ value?: number; count?: number }>
  | unknown;

/** `metadata` may arrive as an object or as a JSON string. Normalise to object. */
function parseMeta(w: FinanceWallet): Record<string, unknown> {
  const raw = w.metadata as unknown;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Sum of counted bank/coin denominations. 0 when there are none. */
export function sumDenominations(d: Denominations): number {
  if (!d) return 0;
  if (Array.isArray(d)) {
    return d.reduce((s, e) => s + (Number(e?.value) || 0) * (Number(e?.count) || 0), 0);
  }
  if (typeof d === 'object') {
    return Object.entries(d as Record<string, number>).reduce(
      (s, [val, cnt]) => s + (parseFloat(val) || 0) * (Number(cnt) || 0),
      0,
    );
  }
  return 0;
}

/**
 * A wallet's balance in ITS OWN currency.
 *
 * Cash and physical wallets are counted from their denominations when they have
 * any, because that is what the user actually holds; every other type reports
 * the stored `balance` (which the backend also recalculates).
 *
 * Crypto/investment wallets are deliberately NOT given asset market value here.
 * Adding asset value at call sites is what produced two different "net worth"
 * answers depending on which surface you asked; that belongs in one place with
 * its own name, and until it exists, `balance` is the honest single number.
 */
export function walletBalance(w: FinanceWallet): number {
  if ((w.type === 'physical' || w.type === 'cash')) {
    const denomSum = sumDenominations(parseMeta(w).denominations);
    if (denomSum > 0) return denomSum;
  }
  return w.balance ?? 0;
}