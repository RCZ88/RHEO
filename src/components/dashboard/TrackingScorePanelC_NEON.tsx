// ============================================================
// RHEO Dashboard — Tracking Score PROTOTYPE C: "NEON GLASS"
// Glowing radial gauge with breathing outer glow ring.
// Glass card with neon top edge (score-reactive color).
// Score band: emerald >= 60, amber 40-59, rose < 40.
// ============================================================

import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, Flame, Target, Clock } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

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

function getScoreColorCss(score: number): string {
  if (score >= 80) return 'emerald-400';
  if (score >= 60) return 'sky-400';
  if (score >= 40) return 'amber-400';
  if (score >= 20) return 'orange-400';
  return 'rose-400';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return <TrendingUp size={10} className="text-emerald-400" />;
    case 'down': return <TrendingDown size={10} className="text-rose-400" />;
    default: return <Minus size={10} className="text-zinc-500" />;
  }
}

export function TrackingScorePanelC({
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
  const colorCss = getScoreColorCss(score);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <WidgetCardC
      widgetId="momentum-summary"
      title="Tracking Score"
      icon={Target}
      neonColor={color}
      kicker="TODAY"
      className={className}
      loading={loading}
      empty={!data}
      emptyMessage="No score data yet today"
      emptyIcon={<Target size={24} />}
    >
      {/* Glowing radial gauge with breathing outer ring */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative inline-block">
          {/* Breathing outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              width: 136, height: 136,
              background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
              filter: 'blur(10px)',
            }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* SVG gauge */}
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="rgba(59,59,66,0.5)"
              strokeWidth="8"
            />
            {/* Animated progress with glow */}
            <motion.circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              filter="url(#glow)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Glow filter */}
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {/* Score number — neon-tinted */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono" style={{ color }}>
                <NumberTicker value={score} delay={200} duration={1200} />
              </div>
              <p className="text-[10px] text-zinc-500 -mt-1">/ 100</p>
            </div>
          </div>
        </div>

        {/* Trend badge — glass pill */}
        <div className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50">
          {getTrendIcon(trend)}
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>
            {trend === 'up' ? 'Up from yesterday' : trend === 'down' ? 'Down from yesterday' : 'Same as yesterday'}
          </span>
        </div>
      </div>

      {/* Breakdown — glass mini-pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={10} className="text-orange-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Streak</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{streak} days</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={10} className="text-violet-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Done</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{completionRate}%</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={10} className="text-cyan-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Focus</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{focusHours}h</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Score</span>
          </div>
          <span className={`text-[13px] font-mono font-medium tabular-nums ${colorCss.replace('400', '300')}`}>
            {score}/100
          </span>
        </div>
      </div>
    </WidgetCardC>
  );
}
