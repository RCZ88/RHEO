import { useMemo } from 'react';
import { TrendingUp, Sparkles, Clock } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import type { FocusHistoryRow } from './focusHelpers';
import { computeWeeklyTrend, computeBestHour, computeAvgSessionLength, fmtDuration } from './focusHelpers';
import { cn } from '@/lib/utils';

interface FocusInsightsProps {
  history: FocusHistoryRow[];
}

function Sparkline({ points, color, height = 64 }: { points: number[]; color: string; height?: number }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 220;
  const h = height;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M${pts.join(' L')}`;
  const areaD = `${pathD} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible" style={{ maxWidth: '100%' }}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-grad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot on last point */}
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.5} fill={color} />
    </svg>
  );
}

export function FocusInsights({ history }: FocusInsightsProps) {
  const hasCompleted = history.some(h => h.outcome === 'completed');
  const trend = useMemo(() => computeWeeklyTrend(history), [history]);
  const bestHour = useMemo(() => computeBestHour(history), [history]);
  const avgLength = useMemo(() => computeAvgSessionLength(history), [history]);

  if (!hasCompleted) return null;

  const minutes = trend.map(d => Math.round(d.focusSec / 60));
  const maxMin = Math.max(...minutes, 1);

  return (
    <GlassCard className="bg-zinc-900/95 border-zinc-800/60">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[var(--page-accent)]" />
        Focus insights
      </h3>

      {/* Trend sparkline */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">This week</span>
          <span className="text-[10px] font-mono tabular-nums text-zinc-500">
            {minutes.length > 0 ? `${minutes[minutes.length - 1]}m today` : ''}
          </span>
        </div>
        <div className="h-16 bg-zinc-800/30 border border-zinc-800/40 rounded-lg p-2 flex items-end">
          <Sparkline points={minutes} color="var(--clay-300)" height={48} />
        </div>
        {/* Day labels under sparkline */}
        <div className="flex justify-between mt-1">
          {trend.map(d => (
            <span key={d.date} className="text-[8px] text-zinc-600 w-6 text-center">
              {d.label.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      {/* Metric chips */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/50">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best focus time</p>
            <p className="text-[13px] font-semibold text-zinc-200">
              {bestHour ? bestHour.label : 'Not enough data'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/50">
          <div className="w-7 h-7 rounded-lg bg-clay-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-clay-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg session</p>
            <p className="text-[13px] font-semibold text-zinc-200">
              {fmtDuration(avgLength)}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
