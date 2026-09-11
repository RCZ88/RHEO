import { Clock, CheckCircle2, TrendingUp, Flame } from 'lucide-react';
import { NumberTicker } from '../../components/ui/number-ticker';
import type { TodayStats } from './focusHelpers';
import { cn } from '@/lib/utils';

interface FocusStatsProps {
  stats: TodayStats;
  streak: number;
}

function completionColor(rate: number): string {
  if (rate >= 75) return 'text-emerald-400';
  if (rate >= 40) return 'text-amber-400';
  return 'text-zinc-500';
}

const minutesFormatter = (v: number) => {
  const m = Math.floor(v / 60);
  const s = Math.round(v % 60);
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const STATS = [
  {
    icon: Clock,
    color: '#38bdf8',
    label: 'Focus today',
    value: (s: TodayStats) => s.focusSec,
    formatter: minutesFormatter,
  },
  {
    icon: CheckCircle2,
    color: '#34d399',
    label: 'Sessions',
    value: (s: TodayStats) => s.completedCount,
    formatter: (v: number) => `${v}`,
  },
  {
    icon: TrendingUp,
    color: 'var(--amber-400)',
    label: 'Completion',
    value: (s: TodayStats) => s.completionRate,
    formatter: (v: number) => `${v}%`,
  },
  {
    icon: Flame,
    color: 'var(--accent-primary)',
    label: 'Streak',
    value: (s: TodayStats, streak: number) => streak,
    formatter: (v: number) => `${v}${v === 1 ? '' : 'd'}`,
  },
] as const;

export function FocusStats({ stats, streak }: FocusStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {STATS.map((stat, i) => {
        const Icon = stat.icon;
        const val = stat.value(stats, streak);
        const formatted = stat.formatter(val);
        return (
          <div
            key={stat.label}
            className={cn(
              'relative rounded-lg p-3 bg-zinc-900/95 border border-zinc-800/60',
            )}
          >
            {/* Accent glow dot */}
            <div
              className="absolute -left-0.5 top-2 w-2 h-2 rounded-full"
              style={{
                background: stat.color,
                boxShadow: `0 0 8px ${stat.color}66`,
              }}
            />
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {stat.label}
              </span>
            </div>
            <NumberTicker
              value={val}
              className={cn(
                'text-lg font-bold tabular-nums font-mono',
                stat.label === 'Completion'
                  ? completionColor(stats.completionRate)
                  : stat.label === 'Streak'
                    ? 'text-pink-400'
                    : 'text-white',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
