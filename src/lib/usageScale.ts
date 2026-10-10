// ============================================================
// usageScale.ts — the visual scale shared by the /activity
// surface (OS Usage Split + Productivity).
//
// WHY THIS FILE EXISTS
// --------------------
// Four things were needed by both surfaces, and each had grown its own
// broken copy inside a page:
//
// 1. PLATFORM LABELS. ActivityPage matched 'win32' / 'darwin', but the
//    `logs.platform` column actually stores 'windows' / 'linux' / NULL.
//    Every comparison fell through to the raw identifier, so the OS
//    filter chips and the OS Usage Split printed the literal strings
//    "windows" and "unknown" into the UI. Verified against the live DB:
//    29073 rows 'windows', 888 'linux', 148 NULL.
//
// 2. A MONOCHROME RAMP, so "which OS" / "which source" can be drawn
//    WITHOUT minting a hue per row. Identity is carried by label, icon
//    and bar length; hue is reserved for meaning (see the tier tokens
//    in tierColors.ts). This is the whole point of the revamp.
//
// 3. ALPHA COMPOSITING for Chart.js. Chart.js resolves colours on the
//    canvas and cannot parse CSS custom properties, so the live token
//    values are read off :root at render time and composited by hand.
//
// 4. A DURATION FORMATTER that does not print "0m" for 40 seconds.
//
// This module imports NOTHING local, so it cannot form an import cycle.
// It is a leaf on purpose (see MEMORY: data in a leaf, logic elsewhere).
// ============================================================

/**
 * Read a CSS custom property off :root. Returns `fallback` when there is
 * no document (main process) or the property is unset. Callers must treat
 * this as render-time only — it is not reactive.
 */
export function cssVar(name: string, fallback = ''): string {
  try {
    if (typeof document === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Composite an alpha onto a `#rgb`/`#rrggbb` colour. Chart.js needs a
 * concrete colour string, and `color-mix()` is not understood by the
 * canvas renderer, so alpha has to be encoded in the hex itself.
 */
export function hexA(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return `#${h}${a.toString(16).padStart(2, '0')}`;
}

/**
 * A CSS `color-mix()` against the theme's own foreground. Because it is
 * relative to `var(--text-primary)`, one declaration inverts correctly
 * between the dark and the warm-paper light theme — no per-theme branch,
 * no second palette, no new tokens.
 */
export function monoFill(percent: number): string {
  return `color-mix(in srgb, var(--text-primary) ${percent}%, transparent)`;
}

/**
 * Four descending steps, ordered loudest-first. Assigned by RANK (largest
 * share first), so the eye reads the dominant row before the tail without
 * any hue doing the work. Four is the cap — beyond that the steps stop
 * being distinguishable and the row is folded into "Other".
 */
export const MONO_STEPS = [82, 58, 40, 26] as const;

export function monoStep(index: number): string {
  return monoFill(MONO_STEPS[Math.min(index, MONO_STEPS.length - 1)]);
}

/**
 * Human labels for `logs.platform`. Every spelling that has ever reached
 * this database is mapped here, including the Node `process.platform`
 * values, because getLogs() falls back to `process.platform` for JSON-mode
 * rows while SQLite rows carry whatever the tracker recorded.
 */
const PLATFORM_LABELS: Record<string, string> = {
  win32: 'Windows',
  win: 'Windows',
  windows: 'Windows',
  darwin: 'macOS',
  macos: 'macOS',
  mac: 'macOS',
  osx: 'macOS',
  linux: 'Linux',
  chromeos: 'ChromeOS',
  cros: 'ChromeOS',
  freebsd: 'FreeBSD',
  android: 'Android',
};

/** Anything absent, blank or literally 'unknown' reads as unlabelled. */
export function platformLabel(platform: string | null | undefined): string {
  const key = (platform ?? '').trim().toLowerCase();
  if (!key || key === 'unknown' || key === 'undefined' || key === 'null') return 'Unrecorded';
  return PLATFORM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Compact duration for axis ticks and inline labels. Unlike the older
 * `formatHours`, sub-minute values keep their seconds instead of
 * collapsing to "0m", and the composition steps down as the number grows
 * so the string never gets wider than the slot it sits in.
 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 > 0 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 > 0 ? `${d}d ${h % 24}h` : `${d}d`;
}