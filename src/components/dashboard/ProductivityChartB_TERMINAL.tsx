// ============================================================
// RHEO Dashboard — Productivity Chart PROTOTYPE B: "TERMINAL CHIC"
// Chart.js wire-frame style. Thin 2px bars, dot markers, no fill.
// Flat bg-zinc-900 panel. Mono labels. Terminal aesthetic.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

Chart.register(...registerables);

interface ProductivityDataPoint {
  day: string;
  productive: number;
  neutral: number;
  distracting: number;
}

interface ProductivityChartProps {
  data: ProductivityDataPoint[];
  loading?: boolean;
  className?: string;
}

const PERIOD_OPTIONS = ['day', 'week', 'month'] as const;
type Period = typeof PERIOD_OPTIONS[number];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHours(h: number): string {
  const hInt = Math.floor(h);
  const m = Math.round((h - hInt) * 60);
  if (hInt > 0) return `${hInt}h ${m}m`;
  return `${m}m`;
}

export function ProductivityChartB({
  data,
  loading = false,
  className = '',
}: ProductivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [period, setPeriod] = useState<Period>('week');

  const totalProductive = data.reduce((s, d) => s + d.productive, 0);
  const totalNeutral = data.reduce((s, d) => s + d.neutral, 0);
  const totalDistracting = data.reduce((s, d) => s + d.distracting, 0);
  const totalAll = totalProductive + totalNeutral + totalDistracting;
  const bestDay = data.length > 0
    ? data.reduce((best, d) => (d.productive > (best?.productive ?? 0) ? d : best), data[0])
    : null;

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.day),
        datasets: [
          {
            label: 'Productive',
            data: data.map(d => d.productive),
            backgroundColor: 'rgba(236, 72, 153, 0.15)',
            borderColor: 'rgba(236, 72, 153, 0.9)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(236, 72, 153, 0.9)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
          {
            label: 'Neutral',
            data: data.map(d => d.neutral),
            backgroundColor: 'rgba(113, 113, 122, 0.1)',
            borderColor: 'rgba(113, 113, 122, 0.7)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 3,
            pointBackgroundColor: 'rgba(113, 113, 122, 0.7)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
          {
            label: 'Distracting',
            data: data.map(d => d.distracting),
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            borderColor: 'rgba(244, 63, 94, 0.8)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 3,
            pointBackgroundColor: 'rgba(244, 63, 94, 0.8)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: 'easeOutQuad',
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#52525b',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
            },
          },
          y: {
            beginAtZero: true,
            max: 8,
            grid: {
              color: 'rgba(59, 59, 66, 0.3)',
              drawBorder: false,
              lineWidth: 1,
            },
            ticks: {
              color: '#52525b',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
              callback: (v) => `${v}h`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#71717a',
            bodyColor: '#a1a1aa',
            borderColor: '#3f3f46',
            borderWidth: 1,
            padding: 6,
            titleFont: { size: 10, family: 'JetBrains Mono, monospace' },
            bodyFont: { size: 11, family: 'JetBrains Mono, monospace' },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatHours(ctx.parsed.y)}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  return (
    <WidgetCardB
      widgetId="productivity-chart"
      title="Productivity"
      icon={BarChart3}
      accent="#22d3ee"
      className={className}
      loading={loading}
      empty={!data.length}
      emptyMessage="No data for this period"
      emptyIcon={<BarChart3 size={16} />}
    >
      {/* Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                period === p
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-600'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-36 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-3 w-40 rounded bg-zinc-800 animate-pulse" />
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      {/* Legend — dot + mono label, no pills */}
      <div className="flex items-center gap-3 mt-1 mb-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(236, 72, 153, 0.8)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">productive</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalProductive)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(113, 113, 122, 0.6)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">neutral</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalNeutral)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(244, 63, 94, 0.8)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">distracting</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalDistracting)}</span>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Total</span>
          <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{formatHours(totalAll)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Best</span>
          <span className="text-[13px] font-mono text-emerald-400/70 tabular-nums">
            {bestDay ? `${bestDay.day} ${formatHours(bestDay.productive)}` : '—'}
          </span>
        </div>
      </div>
    </WidgetCardB>
  );
}
