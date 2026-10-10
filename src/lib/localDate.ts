/**
 * Local-date helpers.
 *
 * WHY THIS FILE EXISTS: `timestamp` is stored as a UTC ISO string, but a human
 * thinks in local days ("Wednesday 10am"). The two disagree for every timezone
 * that is not UTC, and the disagreement is silent. Concretely, on this machine
 * (Asia/Jakarta, UTC+7) `date.toISOString().split('T')[0]` on a local midnight
 * returns the PREVIOUS day — which made all seven heatmap columns open the wrong
 * date. Never use `toISOString()` to build a calendar day key.
 */

/** `YYYY-MM-DD` built from LOCAL date fields. */
export function formatLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a `YYYY-MM-DD` key as LOCAL midnight.
 *
 * `new Date('2026-09-30')` is parsed by the spec as UTC midnight, which is
 * 07:00 on the 30th in UTC+7 — so `.getDay()` and the rendered label are both
 * correct by luck here, but `.getDate()` is the 30th only because the offset
 * never crosses midnight. It DOES cross for any negative offset (UTC-5 → the
 * 29th), so the explicit constructor is the only safe form.
 */
export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/** Shift a local day by N days, keeping local midnight. */
export function addDaysLocal(d: Date, days: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

/** Local midnight at the start of the week containing `d`. */
export function startOfLocalWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}
