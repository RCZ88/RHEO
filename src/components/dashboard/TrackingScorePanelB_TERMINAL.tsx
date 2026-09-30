// ============================================================
// RHEO Dashboard — Tracking Score PROTOTYPE B: "TERMINAL CHIC"
// Segmented horizontal bar (3 segments: streak/completion/focus).
// Flat bg-zinc-900 panel. All mono. Linear, aligned, terminal style.
// ============================================================

import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, Flame, Target, Clock } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

interface MomentumScoreData {
  score: number;
  streak: number;
  completionRate: number;
  focusHours: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrackingScorePanelProps {
  data: MomentumScoreData | null;
  loading?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#fbbf24';
  if (score >= 20) return '#f97316';
  return '#f87171';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return <TrendingUp size={10} className="text-emerald-400" />;
    case 'down': return <TrendingDown size={10} className="text-rose-400" />;
    default: return <Minus size={10} className="text-zinc-500" />;
  }
}

export function TrackingScorePanelB({
  data,
  loading = false,
  className = '',
}: TrackingScorePanelProps) {
  const score = data?.score ?? 0;
  const streak = data?.streak ?? 0;
  const completionRate = data?.completionRate ?? 0;
  const focusHours = data?.focusHours ?? 0;
  const trend = data?.trend ?? 'stable';
  const color = getScoreColor(score);

  // Segment weights: streak 30%, completion 40%, focus 30%
  const streakPct = Math.min(30, streak * 3);
  const completionPct = (completionRate / 100) * 40;
  const focusPct = Math.min(30, focusHours * 3);
  const totalScore = Math.min(100, streakPct + completionPct + focusPct);

  return (
    <WidgetCardB
      widgetId="momentum-summary"
      title="Tracking Score"
      icon={Target}
      accent={color}
      className={className}
      loading={loading}
      empty={!data}
      emptyMessage="No score data today"
      emptyIcon={<Target size={16} />}
    >
      {/* Score number — large mono, centered */}
      <div className="text-center mb-3">
        <div className="text-[28px] font-mono font-bold tabular-nums text-zinc-100">
          <NumberTicker value={score} delay={200} duration={800} />
        </div>
        <div className="text-[11px] font-mono text-zinc-600 mt-1 tracking-wider">/ 100</div>
      </div>

      {/* Segmented bar — 3 segments side by side */}
      <div className="mb-3">
        <div className="flex rounded-none h-5 bg-zinc-800 overflow-hidden">
          {/* Streak segment (30%) — amber */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#fbbf24' }}
            initial={{ width: 0 }}
            animate={{ width: `${streakPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0 }}
          />
          {/* Completion segment (40%) — emerald */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#34d399' }}
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          />
          {/* Focus segment (30%) — cyan */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#22d3ee' }}
            initial={{ width: 0 }}
            animate={{ width: `${focusPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
          {/* Empty remainder */}
          <div className="h-full bg-zinc-800" style={{ width: `${100 - Math.min(100, totalScore)}%` }} />
        </div>
        {/* Segment labels below */}
        <div className="flex justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Streak 30%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#34d399' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Done 40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#22d3ee' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Focus 30%</span>
          </div>
        </div>
      </div>

      {/* Trend pill */}
      <div className="flex items-center justify-center gap-1 mb-3 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700">
        {getTrendIcon(trend)}
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          {trend === 'up' ? 'UP from yesterday' : trend === 'down' ? 'DOWN from yesterday' : 'STABLE'}
        </span>
      </div>

      {/* Meta row — 2-column mono stats */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Streak</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{streak} days</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Done</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{completionRate}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Focus</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{focusHours}h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Trend</span>
            <span className="text-[13px] font-mono" style={{ color }}>{score}/100</span>
          </div>
        </div>
      </div>
    </WidgetCardB>
  );
}
