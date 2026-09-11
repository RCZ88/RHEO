import { Chart, type Plugin } from 'chart.js';

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
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
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
    ctx.fillStyle = '#71717a';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText('TOTAL', cx, cy - 12);
    ctx.fillStyle = '#fafafa';
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

export const sharedScales = {
  x: {
    grid: { color: 'rgba(255,255,255,0.04)' },
    border: { display: false },
    ticks: { color: '#71717a', font: { family: '"JetBrains Mono", monospace', size: 11 } },
  },
  y: {
    grid: { color: 'rgba(255,255,255,0.04)' },
    border: { display: false },
    ticks: { color: '#71717a', font: { family: '"JetBrains Mono", monospace', size: 11 } },
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
