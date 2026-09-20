// ============================================================
// DeskFlow Dashboard — InsightsCard (Revamped v2)
// Skills: Signature Design (MomentumOrb hero),
//         MCP (StreakBadge from Trophy UI, BlurText from ReactBits,
//              NumberTicker from Magic UI, AnimatedShinyText),
//         Impeccable Design (modular type scale, HSL opacity layers),
//         Human-Centric UX (progressive insight disclosure, plain copy)
// ============================================================

import { motion } from 'framer-motion';
import {
  Flame, TrendingUp, Target, Clock, AlertTriangle,
  Zap, Sparkles, BarChart3, PieChart, Activity
} from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import { MomentumOrb } from './MomentumOrb';
import { StreakBadge } from './StreakBadge';
import { BlurText } from './BlurText';
import { SpotlightCard } from './SpotlightCard';
import type { DashboardInsights } from './types';

interface InsightsCardProps {
  insights: DashboardInsights;
  loading?: boolean;
}

export function InsightsCard({ insights, loading = false }: InsightsCardProps) {
  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/40 p-5">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-zinc-800 rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-zinc-800/30 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const {
    streak, longestStreak, momentum, categoryBalance,
    completionRate, urgentDeadlines, focusTimeMinutes, aiSuggestionCount
  } = insights;

  return (
    <SpotlightCard
      spotlightColor="rgba(245, 158, 11, 0.08)"
      className="relative rounded-xl overflow-hidden bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/40 p-5"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />

      {/* Signature Hero Row: MomentumOrb + Key Metrics */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-5 mb-5">
        {/* Momentum Orb — the signature element */}
        <div className="flex items-center gap-4">
          <MomentumOrb momentum={momentum} streak={streak} size={100} />
          <div>
            <BlurText
              text="Your Momentum"
              as="h2"
              className="text-[15px] font-semibold text-zinc-100"
              delay={0.2}
              staggerDelay={0.03}
            />
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {momentum > 70
                ? 'You are on fire. Keep the streak alive.'
                : momentum > 40
                ? 'Steady progress. Push a little harder.'
                : 'Start small. One task builds momentum.'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <StreakBadge streak={streak} longestStreak={longestStreak} size="sm" showCalendar={false} />
              {aiSuggestionCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20"
                >
                  <Sparkles size={11} />
                  <span className="text-[11px] font-medium">{aiSuggestionCount} AI ideas</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Quick metric pills */}
        <div className="flex items-center gap-2 md:ml-auto flex-wrap">
          <MetricPill icon={<Target size={12} className="text-violet-400" />} label="Done" value={completionRate} suffix="%" />
          <MetricPill icon={<Clock size={12} className="text-cyan-400" />} label="Focus" value={focusTimeMinutes} suffix="m" />
          <MetricPill icon={<Activity size={12} className="text-emerald-400" />} label="Score" value={momentum} suffix="" />
        </div>
      </div>

      {/* Category Balance */}
      {categoryBalance.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1.5">
            <PieChart size={12} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-500 font-medium">Where your energy goes</span>
          </div>
          <div className="space-y-1.5">
            {categoryBalance.map((cat, i) => (
              <div key={cat.category} className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 w-20 truncate capitalize">{cat.category}</span>
                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.percentage}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 + i * 0.1 }}
                  />
                </div>
                <span className="text-[10px] text-zinc-600 w-8 text-right font-mono">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent deadlines alert */}
      {urgentDeadlines > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 rounded-lg bg-rose-500/[0.06] border border-rose-500/20 flex items-center gap-2"
        >
          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
          <span className="text-[12px] text-rose-300">
            {urgentDeadlines} urgent deadline{urgentDeadlines > 1 ? 's' : ''} need{urgentDeadlines === 1 ? 's' : ''} attention
          </span>
        </motion.div>
      )}
    </SpotlightCard>
  );
}

function MetricPill({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -1, scale: 1.02 }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/30"
    >
      {icon}
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-[13px] font-bold text-zinc-200 font-mono tabular-nums">
        <NumberTicker value={value} suffix={suffix} delay={200} duration={800} />
      </span>
    </motion.div>
  );
}
