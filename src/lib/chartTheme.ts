import type { Chart } from 'chart.js';

export type ChartPalette = {
  tick: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTitle: string;
  tooltipBody: string;
};

export const chartTheme: Record<'dark' | 'light', ChartPalette> = {
  dark: {
    tick: '#71717a',
    grid: 'rgba(255,255,255,0.04)',
    tooltipBg: 'rgba(24,24,27,0.92)',
    tooltipBorder: 'rgba(255,255,255,0.08)',
    tooltipTitle: '#a1a1aa',
    tooltipBody: '#fafafa',
  },
  light: {
    tick: '#52525b',
    grid: 'rgba(0,0,0,0.06)',
    tooltipBg: 'rgba(255,255,255,0.95)',
    tooltipBorder: 'rgba(0,0,0,0.08)',
    tooltipTitle: '#52525b',
    tooltipBody: '#18181b',
  },
};

export function applyChartTheme(chartClass: typeof Chart, isLight: boolean): void {
  const p = isLight ? chartTheme.light : chartTheme.dark;
  chartClass.defaults.color = p.tick;
  chartClass.defaults.borderColor = p.grid;
  chartClass.defaults.font.family = 'Inter, system-ui, sans-serif';
  const tooltip = (chartClass.defaults as any).plugins?.tooltip;
  if (tooltip) {
    tooltip.backgroundColor = p.tooltipBg;
    tooltip.borderColor = p.tooltipBorder;
    tooltip.titleColor = p.tooltipTitle;
    tooltip.bodyColor = p.tooltipBody;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DATA-VIZ PALETTE (added for the Insights repaint)
//
// WHY THIS EXISTS
// ---------------
// `applyChartTheme` sets Chart.js DEFAULTS. The Insights page overrode every one
// of those defaults inline — six times, with six different hand-typed hex sets
// — so the app's chart theme was completely inert there and light mode was
// unreachable (a `#18181b` tooltip on a cream card is unreadable). These are the
// values a chart needs that DEFAULTS cannot express: a signal hue, a fill ramp
// derived from it, and the one place a second and third hue are legal.
//
// THE RULE THIS ENCODES (LAMINAR §2, one signal hue per surface):
//   Colour on a data surface means TIER, never identity.
//   A category's identity is carried by its axis label and position — colouring
//   seven day-of-week bars seven different hues carries no information, it just
//   makes the eye work. So: ONE hue for "a quantity". THREE hues only when the
//   quantity has a semantic split (productive / neutral / distracting), and then
//   the SAME three everywhere on the page.
// ═══════════════════════════════════════════════════════════════════

export type DataVizPalette = {
  /** The surface's signal hue — one per surface. Fills every single-series chart. */
  accent: string;
  /** accent at ~18% — bar fills, donut segments. */
  accentFill: string;
  /** accent at ~35% — area under a line, hover fills. */
  accentSoft: string;
  /** accent at ~55% — dashed reference/target lines. */
  accentFaint: string;
  /** Track behind a bar or bar-group — recedes, never competes with the data. */
  track: string;
  /** Tier hues. The only legal place three hues appear on one surface. */
  productive: string;
  neutral: string;
  distracting: string;
  /** Shortfall, not a category — a deficit genuinely is the absence of something. */
  deficient: string;
  /** Highest value in a series — the one bar worth pointing at. */
  peak: string;
};

export const dataViz: Record<'dark' | 'light', DataVizPalette> = {
  dark: {
    accent: '#ec4899',        // --page-accent for [data-page="insights"]
    accentFill: 'rgba(236,72,153,0.18)',
    accentSoft: 'rgba(236,72,153,0.35)',
    accentFaint: 'rgba(236,72,153,0.55)',
    track: 'rgba(255,255,255,0.05)',
    productive: '#34d399',    // emerald — success/filled only
    neutral: '#a1a1aa',       // zinc — genuinely nothing
    distracting: '#ef4444',   // rose — the thing the surface is measuring against
    deficient: '#ef4444',
    peak: '#fafafa',
  },
  light: {
    accent: '#db2777',        // darkened for contrast on cream (LAMINAR §11)
    accentFill: 'rgba(219,39,119,0.14)',
    accentSoft: 'rgba(219,39,119,0.28)',
    accentFaint: 'rgba(219,39,119,0.45)',
    track: 'rgba(28,25,23,0.06)',
    productive: '#059669',
    neutral: '#78716c',
    distracting: '#dc2626',
    deficient: '#dc2626',
    peak: '#1c1917',
  },
};

/** Re-exported so callers can pick up the app token palette for chart chrome. */
export function paletteFor(isLight: boolean) {
  return isLight ? chartTheme.light : chartTheme.dark;
}

export function dataVizFor(isLight: boolean): DataVizPalette {
  return isLight ? dataViz.light : dataViz.dark;
}

/**
 * A single hue at descending opacity — `steps` values from `from` down to `to`.
 *
 * This is how magnitude is encoded on every heat/grid surface here: ONE hue, and
 * opacity does the work. It replaced hand-typed `rgba(16,185,129,0.15…0.9)`
 * ladders, which were pinned to emerald regardless of the surface's signal hue
 * and unreadable on cream. Opacity is also the one encoding that survives
 * greyscale, colour-blindness and both themes at once.
 *
 * @param to   opacity of the first step (the weakest cell)
 * @param from opacity of the last step (the strongest cell)
 */
export function ramp(base: string, steps: number, to = 0.15, from = 0.9): string[] {
  const n = Math.max(steps, 1);
  return Array.from({ length: n }, (_, i) =>
    withAlpha(base, n === 1 ? from : to + ((from - to) * i) / (n - 1)),
  );
}

/** Apply an alpha to a hex or rgb() colour. */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
    if (full.length !== 6) return c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.round(alpha * 1000) / 1000})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${Math.round(alpha * 1000) / 1000})`;
  }
  return c;
}

/**
 * The track a meter or bar sits in: present enough to show the extent of the
 * scale, quiet enough to never compete with the value drawn on top of it.
 */
export function meterTrack(isLight: boolean): string {
  return isLight ? 'rgba(28,25,23,0.08)' : 'rgba(255,255,255,0.06)';
}

// ───────────────────────────────────────────────────────────────────
// CATEGORICAL COLOURS FOR CANVAS
//
// LAMINAR §5: `src/lib/CategoryColors.ts` is the ONLY place category→colour is
// defined — but it defines TAILWIND CLASS NAMES ('bg-violet-500/15'), and a
// <canvas> cannot read a class. So this is a hex MIRROR of those same Tailwind
// 500-steps, keyed by the identical category names.
//
// The mirror is the point of friction, so it is made explicit: the keys below
// are asserted to be a subset of the canonical map by
// `src/lib/chartTheme.probe.mjs`, which fails if a category is added upstream
// and not mirrored here. Categories genuinely DO need distinct hues — a legend
// cannot work otherwise — so unlike the day-of-week axis this is the one place a
// categorical palette is correct.
// ───────────────────────────────────────────────────────────────────

const CATEGORY_HEX_DARK: Record<string, string> = {
  'IDE': '#8b5cf6',
  'Browser': '#0ea5e9',
  'AI Tools': '#ec4899',
  'Entertainment': '#ef4444',
  'Communication': '#3b82f6',
  'Design': '#d946ef',
  'Productivity': '#10b981',
  'Developer Tools': '#06b6d4',
  'Tools': '#f59e0b',
  'News': '#f97316',
  'Shopping': '#f43f5e',
  'Social Media': '#ec4899',
  'Uncategorized': '#71717a',
  'Other': '#71717a',
};

/** Tailwind 600-steps: darkened so every category clears 3:1 on cream (LAMINAR §11). */
const CATEGORY_HEX_LIGHT: Record<string, string> = {
  'IDE': '#7c3aed',
  'Browser': '#0284c7',
  'AI Tools': '#db2777',
  'Entertainment': '#dc2626',
  'Communication': '#2563eb',
  'Design': '#c026d3',
  'Productivity': '#059669',
  'Developer Tools': '#0891b2',
  'Tools': '#d97706',
  'News': '#ea580c',
  'Shopping': '#e11d48',
  'Social Media': '#db2777',
  'Uncategorized': '#78716c',
  'Other': '#78716c',
};

/** Resolve a category name to a canvas colour, for the current theme. */
export function categoryHex(category: string, isLight: boolean): string {
  const table = isLight ? CATEGORY_HEX_LIGHT : CATEGORY_HEX_DARK;
  return table[category] ?? table['Other'];
}

/** Map labels to colours, for a doughnut/legend. */
export function categoryHexList(labels: string[], isLight: boolean): string[] {
  return labels.map(l => categoryHex(l, isLight));
}

/** The mirrored keys, so a probe can assert the mirror against the source. */
export const CATEGORY_HEX_KEYS = Object.keys(CATEGORY_HEX_DARK);

// ───────────────────────────────────────────────────────────────────
// SHARED AXIS / GRID / TOOLTIP TREATMENT
//
// Six charts that each hand-rolled their own scales and tooltip boxes read as
// six different applications stapled together. These factories give every chart
// the same grid weight, tick size, tooltip shape and unit suffix, so the page
// reads as one instrument panel.
// ───────────────────────────────────────────────────────────────────

export type AxisStyle = {
  grid: string;
  tick: string;
  font: { family: string; size: number };
};

/** Horizontal-only gridlines. Vertical gridlines are noise on a time axis. */
export function xAxis(p: ChartPalette, opts: { maxTicks?: number } = {}) {
  return {
    grid: { display: false, drawBorder: false },
    border: { color: p.grid },
    ticks: {
      color: p.tick,
      font: { family: 'Inter, system-ui, sans-serif', size: 10 },
      maxRotation: 0,
      autoSkipPadding: 12,
      maxTicksLimit: opts.maxTicks ?? 10,
    },
  };
}

export function yAxis(p: ChartPalette, opts: { beginAtZero?: boolean; suggestedMax?: number; suffix?: string } = {}) {
  return {
    // beginAtZero / suggestedMax are SCALE-level options in Chart.js. Nesting
    // them under `ticks` compiles, type-checks and silently does nothing — which
    // is how a "starts at zero" axis ends up auto-scaled to whatever the data
    // happens to be, exaggerating small differences.
    beginAtZero: opts.beginAtZero ?? true,
    suggestedMax: opts.suggestedMax,
    grid: { color: p.grid, drawBorder: false, drawTicks: false },
    border: { display: false },
    ticks: {
      color: p.tick,
      font: { family: 'Inter, system-ui, sans-serif', size: 10 },
      padding: 6,
      callback: opts.suffix
        ? (v: string | number) => `${v}${opts.suffix}`
        : undefined,
    },
  };
}

export function legendStyle(p: ChartPalette) {
  return {
    display: true,
    position: 'bottom' as const,
    align: 'start' as const,
    labels: {
      color: p.tick,
      usePointStyle: true,
      pointStyle: 'circle',
      pointStyleRadius: 3,
      boxHeight: 6,
      boxWidth: 6,
      padding: 14,
      font: { family: 'Inter, system-ui, sans-serif', size: 11 },
    },
  };
}

export function tooltipStyle(p: ChartPalette, suffix = '') {
  return {
    backgroundColor: p.tooltipBg,
    borderColor: p.tooltipBorder,
    borderWidth: 1,
    titleColor: p.tooltipBody,
    bodyColor: p.tooltipTitle,
    titleFont: { family: 'Inter, system-ui, sans-serif', size: 12, weight: 600 },
    bodyFont: { family: 'Inter, system-ui, sans-serif', size: 11 },
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
    boxWidth: 6,
    boxHeight: 6,
    boxPadding: 4,
    usePointStyle: true,
    // One unit label for the whole app, so a number means the same thing in
    // every tooltip. "4.2" alone is a unitless guess; "4.2h" is not.
    callbacks: suffix
      ? {
          label: (ctx: any) => {
            const raw = typeof ctx.parsed === 'number' ? ctx.parsed : ctx.parsed?.y;
            const name = ctx.dataset?.label ? `${ctx.dataset.label}: ` : '';
            return raw == null ? `${name}—` : `${name}${Math.round(raw * 100) / 100}${suffix}`;
          },
        }
      : undefined,
  };
}

/**
 * Build a complete Chart.js options object from the app palette.
 * Anything a specific chart needs on top goes in `overrides` and is merged one
 * level deep, so a chart can adjust a scale without re-declaring the tooltip.
 */
export function chartOptions<T extends Record<string, any>>(
  p: ChartPalette,
  overrides: {
    x?: Record<string, any>;
    y?: Record<string, any>;
    legend?: boolean;
    suffix?: string;
  } & Record<string, any> = {},
): T {
  const { x, y, legend = false, suffix = '', scales, plugins, ...rest } = overrides;
  const legendKey = Object.keys(plugins ?? {}).find(k => k === 'legend');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    ...rest,
    plugins: {
      legend: legendKey === 'legend' ? plugins!.legend : (legend ? legendStyle(p) : { display: false }),
      tooltip: tooltipStyle(p, suffix),
      ...plugins,
    },
    scales: {
      x: { ...xAxis(p), ...(x ?? {}) },
      y: { ...yAxis(p, { suffix }), ...(y ?? {}) },
      ...(scales ?? {}),
    },
  } as unknown as T;
}