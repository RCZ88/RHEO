/**
 * Duration formatting shared by the heatmap and the day-detail page.
 *
 * Exists because these two surfaces used to format the same number two different
 * ways — the heatmap's tooltip printed `01:24:00` (a clock) for what is really a
 * quantity of time, while the day page printed `1h 24m`. Same data, two truths.
 */

function assertFinite(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}

/** Human duration from SECONDS. `1h 24m` / `24m` / `48s` / `0m`. */
export function humanDuration(seconds: number): string {
  const total = assertFinite(seconds);
  if (total === 0) return '0m';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** Compact form for dense rows: `1h 24m` → `1h 24`, `24m` → `24m`. */
export function humanDurationCompact(seconds: number): string {
  const total = assertFinite(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** Milliseconds → human. Callers holding `duration_ms` use this. */
export function humanDurationFromMs(ms: number): string {
  return humanDuration((ms || 0) / 1000);
}

/** `0..1` → `0..100`, guarding NaN and out-of-range ratios. */
export function percent(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/** Clock label for an hour index, e.g. 0 → `12am`, 13 → `1pm`. */
export function formatHourLabel(hour: number): string {
  const h = Math.floor(hour);
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
