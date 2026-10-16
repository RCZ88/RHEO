import { Chart, type Plugin } from 'chart.js';
import { withAlpha } from './chartTheme';
import { isLightNow } from './theme';

/**
 * Resolve a CSS custom property to a colour `<canvas>` can actually parse.
 *
 * Canvas is not the DOM. `ctx.fillStyle = 'var(--text-primary)'` is an INVALID value,
 * so the assignment is silently IGNORED and the previous value stays — which for
 * Chart.js is its default stroke `#000`. That is how a "theme-aware" chart ends up
 * drawing a black outline on cream paper, with no warning anywhere.
 *
 * So read the property off the live DOM instead, at draw time: a theme change needs
 * no chart rebuild, because the next frame already reads the new value. A token whose
 * value canvas cannot parse (`oklch()`, a bare custom-property reference) falls back
 * to the caller's constant rather than silently painting black.
 */
const CANVAS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;

export function cssColor(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return CANVAS_COLOR.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** The theme's strongest ink, for canvas. Dark `#fafafa` · Warm Paper `#1c1917`. */
export function inkColor(): string {
  return cssColor('--text-primary', '#fafafa');
}

/** The theme's subordinate label ink, for canvas. Dark `#8b8b94` · Warm Paper `#57534e`. */
export function labelInk(): string {
  return cssColor('--text-muted', '#8b8b94');
}

export function makeGradient(ctx: any, hex: string): CanvasGradient {
  const c = ctx.chart.ctx;
  const top = ctx.chart.chartArea?.top ?? 0;
  const bottom = ctx.chart.chartArea?.bottom ?? 200;
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, hex + 'E6');
  g.addColorStop(1, hex + '1A');
  return g;
}

export const glassBackdrop: Plugin = {
  id: 'glassBackdrop',
  beforeDraw(chart) {
    const { ctx, chartArea: { left, top, right, bottom } } = chart;
    ctx.save();
    // A 2% white veil lifts a dark panel; on paper that same veil is a no-op, so the
    // tint flips to ink and the backdrop still reads as a recessed well.
    ctx.fillStyle = withAlpha(inkColor(), isLightNow() ? 0.04 : 0.02);
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(left + r, top);
    ctx.lineTo(right - r, top);
    ctx.quadraticCurveTo(right, top, right, top + r);
    ctx.lineTo(right, bottom - r);
    ctx.quadraticCurveTo(right, bottom, right - r, bottom);
    ctx.lineTo(left + r, bottom);
    ctx.quadraticCurveTo(left, bottom, left, bottom - r);
    ctx.lineTo(left, top + r);
    ctx.quadraticCurveTo(left, top, left + r, top);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

export const centerText: Plugin = {
  id: 'centerText',
  afterDraw(chart) {
    const pluginOpts = chart.options.plugins?.centerText;
    if (!pluginOpts || typeof pluginOpts !== 'object' || !pluginOpts.enabled) return;
    const { ctx, chartArea: { left, right, top, bottom } } = chart;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const meta = chart.getDatasetMeta(0);
    if (!meta.total) return;
    const centerValue = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
    const mode = (pluginOpts as any).mode || 'time';
    let displayText: string;
    if (mode === 'currency') {
      displayText = centerValue >= 1000000
        ? `${(centerValue / 1000000).toFixed(1)}M`
        : centerValue >= 1000
        ? `${(centerValue / 1000).toFixed(1)}K`
        : centerValue.toFixed(0);
    } else if (mode === 'count') {
      displayText = centerValue >= 1000000
        ? `${(centerValue / 1000000).toFixed(1)}M`
        : centerValue >= 10000
        ? `${(centerValue / 1000).toFixed(1)}K`
        : centerValue.toLocaleString();
    } else {
      // time mode (default) — seconds → h/m
      const h = Math.floor(centerValue / 3600);
      const m = Math.floor((centerValue % 3600) / 60);
      displayText = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    ctx.save();
    ctx.textAlign = 'center';
    // This readout IS the chart's headline number, so it must take the theme's
    // strongest ink. A hardcoded value is invisible on the opposite theme:
    // `#fafafa` on Warm Paper measured 1.03:1 — white text on white paper.
    ctx.fillStyle = labelInk();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText('TOTAL', cx, cy - 12);
    ctx.fillStyle = inkColor();
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText(displayText, cx, cy + 12);
    ctx.restore();
  }
};

export const sharedTooltipStyle = {
  backgroundColor: 'rgba(24,24,27,0.92)',
  borderColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  titleColor: '#a1a1aa',
  bodyColor: '#fafafa',
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
  boxPadding: 4,
  titleFont: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '600' as const },
  bodyFont: { family: '"JetBrains Mono", monospace', size: 13 },
};

// Format a duration (in seconds) as a compact axis tick label — minutes/hours, never raw seconds
export function formatAxisTick(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

// Grid and tick colours are SCRIPTABLE — chart.js 4 re-evaluates them on every draw —
// so they stay a function of the live theme instead of a snapshot: flipping the theme
// repaints the axes correctly without rebuilding any chart. Never a `var()` here:
// canvas would ignore it and leave the previous stroke (see cssColor).
const gridInk = () => withAlpha(inkColor(), isLightNow() ? 0.06 : 0.04);
const tickInk = () => labelInk();

export const sharedScales = {
  x: {
    grid: { color: gridInk },
    border: { display: false },
    ticks: { color: tickInk, font: { family: '"JetBrains Mono", monospace', size: 11 } },
  },
  y: {
    grid: { color: gridInk },
    border: { display: false },
    ticks: { color: tickInk, font: { family: '"JetBrains Mono", monospace', size: 11 } },
    beginAtZero: true,
  },
};

export const barAnimation = {
  duration: 600,
  easing: 'easeOutQuart' as const,
};

export const pieAnimation = {
  animateScale: true,
  animateRotate: true,
  duration: 700,
  easing: 'easeOutQuart' as const,
};
