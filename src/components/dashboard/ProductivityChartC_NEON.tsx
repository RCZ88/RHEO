// ============================================================
// RHEO Dashboard — Productivity Chart PROTOTYPE C: "NEON GLASS"
// Chart.js neon bars with glow. Glass panel with cyan edge.
// Rounded bars with subtle category-colored shadow glow.
// Glass legend pills + glass period selector.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

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

function formatHours(h: number): string {
  const hInt = Math.floor(h);
  const m = Math.round((h - hInt) * 60);
  if (hInt > 0) return `${hInt}h ${m}m`;
  return `${m}m`;
}

export function ProductivityChartC({
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
            backgroundColor: 'rgba(236, 72, 153, 0.55)',
            borderColor: 'rgba(236, 72, 153, 0.9)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: 'Neutral',
            data: data.map(d => d.neutral),
            backgroundColor: 'rgba(113, 113, 122, 0.35)',
            borderColor: 'rgba(113, 113, 122, 0.6)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: 'Distracting',
            data: data.map(d => d.distracting),
            backgroundColor: 'rgba(244, 63, 94, 0.55)',
            borderColor: 'rgba(244, 63, 94, 0.9)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: 'easeOutQuad',
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#71717a',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
            },
          },
          y: {
            beginAtZero: true,
            max: 8,
            grid: {
              color: 'rgba(59, 59, 66, 0.15)',
              drawBorder: false,
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
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#fafafa',
            bodyColor: '#a1a1aa',
            borderColor: 'rgba(59, 59, 66, 0.5)',
            borderWidth: 1,
            padding: 8,
            titleFont: { size: 11, family: 'JetBrains Mono, monospace' },
            bodyFont: { size: 12, family: 'JetBrains Mono, monospace' },
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
    <WidgetCardC
      widgetId="productivity-chart"
      title="Productivity"
      icon={BarChart3}
      neonColor="#22d3ee"
      kicker={`THIS ${period.toUpperCase()}`}
      className={className}
      loading={loading}
      empty={!data.length}
      emptyMessage="No data for this period"
      emptyIcon={<BarChart3 size={24} />}
    >
      {/* Controls — glass dropdown */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase transition-all duration-200 ${
                period === p
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:shadow-[0_0_12px_-4px_rgba(34,211,238,0.15)]'
                  : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area — glass bordered */}
      <div className="h-40 w-full rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-4 w-48 rounded bg-zinc-800/50 animate-pulse" />
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      {/* Legend — glass pills with subtle glow */}
      <div className="flex items-center gap-3 mt-2 mb-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(236, 72, 153, 0.8)', boxShadow: '0 0 6px -2px rgba(236,72,153,0.4)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Productive</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalProductive)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(113, 113, 122, 0.6)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Neutral</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalNeutral)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(244, 63, 94, 0.8)', boxShadow: '0 0 6px -2px rgba(244,63,94,0.4)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Distracting</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalDistracting)}</span>
        </div>
      </div>

      {/* Bottom stats — glass pills */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex flex-col px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Total</span>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{formatHours(totalAll)}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Best day</span>
          <span className="text-[13px] font-mono font-medium text-emerald-400 tabular-nums">
            {bestDay ? `${bestDay.day} — ${formatHours(bestDay.productive)}` : '—'}
          </span>
        </div>
      </div>
    </WidgetCardC>
  );
}
