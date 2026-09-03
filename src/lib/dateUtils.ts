/**
 * Local-date utilities — avoids UTC shift bugs from toISOString().
 * The user is in UTC+7; toISOString() on a local midnight Date produces
 * the previous day's UTC date. These helpers always use local year/month/day.
 */

/** Format a Date as YYYY-MM-DD in local time. */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as YYYY-MM-DDTHH:mm:ss in local time (no Z, no ms). */
export function toLocalDateTimeString(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function getTodayLocal(): string {
  return toLocalDateString(new Date());
}
