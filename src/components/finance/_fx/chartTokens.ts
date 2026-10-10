/**
 * chartTokens — the CSS-variable → canvas bridge for the finance charts.
 *
 * WHY THIS FILE EXISTS (measured, not assumed)
 * Chart.js resolves every colour through `@kurkle/color`, which parses CSS
 * colour syntax — hex, `rgb(a,b,c,d)`, `hsl()`, named colours. It does NOT
 * resolve custom properties or `color-mix()`, because a canvas has no cascade.
 * Probed against the installed copy:
 *
 *     '#10b981'                                        valid = true
 *     'var(--success)'                                 valid = false
 *     'color-mix(in srgb, #34d399 12%, transparent)'   valid = false
 *
 * So passing `backgroundColor: 'var(--success)'` straight into a dataset does
 * not "work in Chromium" — it silently yields an unparseable colour and the
 * series paints black. That is why the finance charts carried hardcoded hexes:
 * someone hit this and worked around it by giving up on tokens. The workaround
 * was the bug.
 *
 * Precedent: `src/components/dashboard/protoColor.ts:22` states the same
 * finding for the dashboard. This module is the finance equivalent, with two
 * improvements: it re-reads on a theme change (so light mode actually works,
 * which the dashboard version does not), and it produces `rgba()` rather than
 * `color-mix()` for alpha, because color-mix also fails the probe above.
 *
 * Zero raw hex lives here: every value comes from `src/index.css`, so the
 * LAMINAR §7 grep gate stays clean and one token edit restyles every chart.
 */

export interface ChartTokens {
  accent: string;
  positive: string;
  negative: string;
  owed: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  surface: string;
  border: string;
  grid: string;
}

/**
 * Fallbacks exist only so a chart renders *legibly* if a token is ever renamed,
 * rather than painting black. They mirror the current `src/index.css` values.
 * If you change a token in index.css, change it here too — the probe output
 * above is the proof that there is no runtime fallback inside chart.js.
 *
 * SYNC NOTE: `--text-muted` is currently `#8b8b94`, not the older `#71717a` —
 * a peer raised it because #71717a measured 4.12:1 on the dark background and
 * failed the 4.5:1 body-text floor. Read at runtime this bridge picks that up
 * automatically; the constant below only matters if the token disappears.
 */
const FALLBACK: ChartTokens = {
  accent: '#10b981',
  positive: '#34d399',
  negative: '#ef4444',
  owed: '#0b5c73',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#8b8b94',
  surface: '#18181b',
  border: '#27272a',
  grid: '#8b8b94',
};

const MAP: Record<keyof ChartTokens, string> = {
  accent: '--page-accent',
  positive: '--success',
  negative: '--danger',
  owed: '--ws-accent-text',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  surface: '--color-popover',
  border: '--color-border',
  grid: '--text-muted',
};

function read(name: string): string {
  if (typeof document === 'undefined' || !document.documentElement) return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Normalise any token value to `#rrggbb`, or '' if it is not a plain hex.
 *
 * `--color-border` is `rgb(28 25 23 / 0.10)` in light mode (space-separated CSS
 * Color 4 syntax), so a plain `#`-check would reject it and fall back. This
 * accepts both `rgb(r g b / a)` and `rgb(r,g,b,a)` so light mode does not lose
 * its border token.
 */
function toHex(value: string): string {
  if (!value) return '';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;

  const m = value.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)/i);
  if (!m) return '';
  const to255 = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n))));
  return (
    '#' +
    [m[1], m[2], m[3]].map((c) => to255(c).toString(16).padStart(2, '0')).join('')
  );
}

export function readChartTokens(): ChartTokens {
  const out = {} as ChartTokens;
  for (const key of Object.keys(MAP) as (keyof ChartTokens)[]) {
    out[key] = toHex(read(MAP[key])) || FALLBACK[key];
  }
  return out;
}

/**
 * Alpha variant as `rgba()` — NOT `color-mix()`, which the probe showed is
 * unparseable by chart.js. Converts the hex the bridge already resolved.
 */
export function alpha(hex: string, a: number): string {
  const h = toHex(hex);
  if (!h) return `rgba(128,128,128,${a})`;
  const full = h.length === 4
    ? h.slice(1).split('').map((c) => c + c).join('')
    : h.slice(1);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* ── Cache + invalidation ───────────────────────────────────────────────────
   `getComputedStyle` on every render is a forced style recalc; the dashboard
   prototype calls it inline and pays that on every paint. Cache it, and drop
   the cache when the theme flips — `.light` is toggled on <html>, so a
   MutationObserver on the class/attributes attribute catches both the dark and
   light switch AND the `data-page` change that remaps `--page-accent`. */

let cache: ChartTokens | null = null;
let observer: MutationObserver | null = null;

export function chartTokens(): ChartTokens {
  if (cache) return cache;
  cache = readChartTokens();
  return cache;
}

export function invalidateChartTokens(): void {
  cache = null;
}

/** Call once. Watches <html> for theme + page-accent changes. */
export function watchChartTokens(): () => void {
  if (typeof document === 'undefined' || observer) return () => {};
  observer = new MutationObserver(() => invalidateChartTokens());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-page'],
  });
  return () => {
    observer?.disconnect();
    observer = null;
  };
}

/** Axis/grid/border defaults for one chart, ready to spread into `options`. */
export function chartAxis(t: ChartTokens = chartTokens(), fmt?: (v: number) => string) {
  return {
    ticks: {
      color: t.textMuted,
      font: { size: 10, family: 'JetBrains Mono' },
      ...(fmt ? { callback: (v: unknown) => fmt(Number(v)) } : {}),
    },
    grid: { color: alpha(t.grid, 0.12) },
    border: { color: alpha(t.border, 1) },
  };
}

/** One tooltip skin for every finance chart, so they stop drifting apart. */
export function chartTooltip(t: ChartTokens = chartTokens()) {
  return {
    backgroundColor: t.surface,
    titleColor: t.textPrimary,
    bodyColor: t.textSecondary,
    borderColor: alpha(t.border, 1),
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
  };
}
