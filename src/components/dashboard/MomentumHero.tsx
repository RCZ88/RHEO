import { motion } from 'motion/react';
import { Flame, TrendingUp, Activity, ArrowUp, ArrowDown, Minus, Target, Clock, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { MomentumScore } from './types';

interface MomentumHeroProps {
  momentum: MomentumScore | null;
  loading?: boolean;
}

const trendConfig = {
  up: { icon: ArrowUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Up from yesterday' },
  down: { icon: ArrowDown, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Down from yesterday' },
  stable: { icon: Minus, color: 'text-zinc-400 light:text-stone-500', bg: 'bg-zinc-800/50', border: 'border-zinc-700/30', label: 'Same as yesterday', colorLight: 'text-stone-500', bgLight: 'bg-stone-100', borderLight: 'border-stone-300' },
};

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent — you\'re crushing it';
  if (score >= 60) return 'Good — steady progress';
  if (score >= 40) return 'Fair — room to improve';
  if (score >= 20) return 'Low — try completing a goal';
  return 'Just getting started';
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-sky-400';
  if (score >= 40) return 'text-amber-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-zinc-400 light:text-stone-500';
}

export function MomentumHero({ momentum, loading = false }: MomentumHeroProps) {
  const score = momentum?.score ?? 0;
  const streak = momentum?.streak ?? 0;
  const consistency = momentum?.consistency ?? 0;
  const trend = momentum?.trend ?? 'stable';
  const completionRate = momentum?.completionRate ?? 0;
  const scheduleAdherence = momentum?.scheduleAdherence ?? 0;
  const trendInfo = trendConfig[trend];
  const TrendIcon = trendInfo.icon;
  const isActive = streak > 0 || score > 30;

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-zinc-800/50 light:border-[var(--ws-border)] bg-[rgba(24,24,27,0.60)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent light:from-[var(--page-accent)]/30 light:via-[var(--page-accent)]/10" />
                <div className="relative p-5 min-h-[200px]">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 bg-zinc-800 light:bg-stone-200 rounded w-1/3" />
                                        <div className="h-8 bg-zinc-800 light:bg-stone-200 rounded w-1/2" />
                                        <div className="h-3 bg-zinc-800 light:bg-stone-200 rounded w-2/3" />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-12 bg-zinc-800/50 light:bg-stone-200/50 rounded-lg" />
                                            <div className="h-12 bg-zinc-800/50 light:bg-stone-200/50 rounded-lg" />
                      <div className="h-12 bg-zinc-800/50 rounded-lg light:bg-stone-200/70" />
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="relative overflow-hidden rounded-xl border border-zinc-800/50 bg-[rgba(24,24,27,0.60)] light:bg-[var(--color-card)] light:border-[var(--ws-border)]">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent light:from-[var(--page-accent)]/30 light:via-[var(--page-accent)]/10" />

      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, var(--page-accent) 0%, transparent 70%)', filter: 'blur(20px)' }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 p-5 pb-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 light:text-stone-500 font-sans">
            Daily Momentum
          </span>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${trendInfo.color} ${trendInfo.bg} border ${trendInfo.border}`}>
            <TrendIcon size={10} />
            {trendInfo.label}
          </div>
        </div>

        {/* Score */}
        <div className="mb-1 px-5">
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-[40px] font-bold leading-none tracking-tight tabular-nums ${getScoreColor(score)}`}>
              <NumberTicker value={score} delay={200} duration={800} />
            </span>
            <span className="text-[13px] text-zinc-500 light:text-stone-500 font-sans">/100</span>
          </div>
          <p className="text-[11px] text-zinc-500 light:text-stone-500 font-sans mt-1">{getScoreLabel(score)}</p>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 mb-3 px-5">
            <Flame size={12} className="text-amber-400 light:text-amber-700" />
            <span className="text-[11px] text-zinc-400 light:text-stone-500 font-sans">
              <span className="font-mono font-semibold text-amber-300 light:text-amber-700 tabular-nums">{streak}</span> day streak — keep going!
            </span>
          </div>
        )}

        {/* Breakdown — what each number means */}
        <div className="mt-auto pt-3 border-t border-zinc-800/50 light:border-stone-200/70 space-y-2 px-5 pb-5">
          <p className="text-[10px] text-zinc-600 light:text-stone-400 font-sans uppercase tracking-wider mb-2">How it's calculated</p>
          
          <div className="flex items-center gap-2">
            <Target size={10} className="text-violet-400/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 light:text-stone-500 font-sans">Goals completed today</span>
                <span className="font-mono text-[11px] font-semibold text-zinc-300 light:text-stone-700 tabular-nums">{completionRate}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 light:bg-[var(--ws-surface-sunken)] overflow-hidden mt-1">
                              <motion.div
                                className="h-full bg-violet-500/60 light:bg-[var(--ws-accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="text-[9px] text-zinc-600/70 light:text-stone-400/70 font-sans mt-0.5">40% of your score</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={10} className="text-sky-400/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 light:text-stone-500 font-sans">Time in scheduled blocks</span>
                <span className="font-mono text-[11px] font-semibold text-zinc-300 light:text-stone-700 tabular-nums">{scheduleAdherence}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 light:bg-[var(--ws-surface-sunken)] overflow-hidden mt-1">
                              <motion.div
                                className="h-full bg-sky-500/60 light:bg-[var(--ws-accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${scheduleAdherence}%` }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="text-[9px] text-zinc-600/70 light:text-stone-400/70 font-sans mt-0.5">30% of your score</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity size={10} className="text-cyan-400/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 light:text-stone-500 font-sans">Weekly consistency</span>
                <span className="font-mono text-[11px] font-semibold text-zinc-300 light:text-stone-700 tabular-nums">{consistency}%</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 light:bg-[var(--ws-surface-sunken)] overflow-hidden mt-1">
                              <motion.div
                                className="h-full bg-cyan-500/60 light:bg-[var(--ws-accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${consistency}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="text-[9px] text-zinc-600/70 light:text-stone-400/70 font-sans mt-0.5">20% of your score</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Flame size={10} className="text-amber-400/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 light:text-stone-500 font-sans">Day streak</span>
                <span className="font-mono text-[11px] font-semibold text-zinc-300 light:text-stone-700 tabular-nums">{Math.min(streak, 10)}/10</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 light:bg-[var(--ws-surface-sunken)] overflow-hidden mt-1">
                              <motion.div
                                className="h-full bg-amber-500/60 light:bg-[var(--ws-accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(streak * 10, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="text-[9px] text-zinc-600/70 light:text-stone-400/70 font-sans mt-0.5">10% of your score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
