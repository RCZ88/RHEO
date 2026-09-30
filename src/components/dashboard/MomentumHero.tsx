import { motion } from 'motion/react';
import { Flame, Activity, ArrowUp, ArrowDown, Minus, Target, Clock } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { MomentumScore } from './types';

interface MomentumHeroProps {
  momentum: MomentumScore | null;
  loading?: boolean;
  isCurrentlyProductive?: boolean;
  isDistracting?: boolean;
}

const trendConfig = {
  up: { icon: ArrowUp, color: 'text-zinc-300', bg: 'bg-white/[0.04]', border: 'border-zinc-700/40', label: 'Up from yesterday' },
  down: { icon: ArrowDown, color: 'text-zinc-300', bg: 'bg-white/[0.04]', border: 'border-zinc-700/40', label: 'Down from yesterday' },
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
  if (score >= 80) return 'text-amber-300';
  if (score >= 60) return 'text-amber-400/90';
  if (score >= 40) return 'text-amber-400/80';
  if (score >= 20) return 'text-amber-500/70';
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

  // Progressive disclosure: only show a breakdown row when its feature is actually
  // configured. Showing "Goals completed today — 0%" to someone with no goals is
  // noise, not information. Default to hidden so a stale/partial payload can't
  // resurrect rows for features that were never set up.
  const showGoals = momentum?.hasGoals === true;
  const showSchedule = momentum?.hasSchedule === true;
  const breakdownRows = [
    showGoals && { key: 'goals', Icon: Target, label: 'Goals completed today', value: `${completionRate}%`, width: completionRate, weight: '40% of your score', delay: 0 },
    showSchedule && { key: 'schedule', Icon: Clock, label: 'Time in scheduled blocks', value: `${scheduleAdherence}%`, width: scheduleAdherence, weight: '30% of your score', delay: 0.1 },
    { key: 'consistency', Icon: Activity, label: 'Weekly consistency', value: `${consistency}%`, width: consistency, weight: '20% of your score', delay: 0.2 },
    { key: 'streak', Icon: Flame, label: 'Day streak', value: `${Math.min(streak, 10)}/10`, width: Math.min(streak * 10, 100), weight: '10% of your score', delay: 0.3 },
  ].filter(Boolean) as {
    key: string; Icon: typeof Target; label: string; value: string; width: number; weight: string; delay: number;
  }[];

  // FIXED identity accent. Momentum used to branch on live tracking state, so its
  // hue shifted on every launch depending on the foreground app. StatusBand already
  // carries the live tier signal — Momentum is the stable score readout, and it is
  // desaturated to sit in the same quiet register as the stopwatch beside it.
  const ACCENT = 'var(--color-amber-400, #fbbf24)';

  if (loading) {
    return (
      <div className="mh-root h-full flex flex-col p-5 relative">
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-zinc-800 light:bg-stone-200 rounded w-1/3" />
          <div className="h-8 bg-zinc-800 light:bg-stone-200 rounded w-1/2" />
          <div className="h-3 bg-zinc-800 light:bg-stone-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="mh-root h-full flex flex-col p-5 relative">
      {/* No shell of its own: DeskFlowCardMotion already draws the panel. A second
          rounded border + 3 hairlines here is what made the pair look bolted on. */}

      <div className="relative z-10 flex flex-col flex-1">
                  {/* Header — same uppercase/tracking register as the stopwatch */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT, opacity: 0.7 }} />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400 font-sans">
                        Daily Momentum
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${trendInfo.color} ${trendInfo.bg} border ${trendInfo.border}`}>
                      <TrendIcon size={10} />
                      {trendInfo.label}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="mb-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono text-[40px] font-bold leading-none tracking-tight tabular-nums ${getScoreColor(score)}`}>
                        <NumberTicker value={score} delay={200} duration={800} />
                      </span>
                      <span className="text-[13px] text-zinc-500 font-sans">/100</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-sans mt-1.5">{getScoreLabel(score)}</p>
                  </div>

                  {/* Streak */}
                  {streak > 0 && (
                    <div className="flex items-center gap-1.5 mb-3">
<Flame size={12} className="text-amber-500/70" />
                        <span className="text-[11px] text-zinc-400 font-sans">
                          <span className="font-mono font-semibold text-amber-400/90 tabular-nums">{streak}</span> day streak — keep going!
                        </span>
                    </div>
                  )}

                  {/* Breakdown */}
                  <div className="mt-auto pt-3 border-t border-zinc-800/50 space-y-2">
                    <p className="text-[10px] text-zinc-600 font-sans uppercase tracking-wider mb-2">How it's calculated</p>
            
                    {breakdownRows.map(({ key, Icon, label, value, width, weight, delay }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Icon size={10} className="text-zinc-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400 font-sans">{label}</span>
                            <span className="font-mono text-[11px] font-semibold text-zinc-300 tabular-nums">{value}</span>
                          </div>
                          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden mt-1">
                            <motion.div
                              className="h-full bg-amber-500/40 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${width}%` }}
                              transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <p className="text-[9px] text-zinc-600 font-sans mt-0.5">{weight}</p>
                        </div>
                      </div>
                    ))}
                    {breakdownRows.length === 0 && (
                      <p className="text-[11px] text-zinc-600 font-sans">
                        Set up goals or a schedule to see how today's score is built.
                      </p>
                    )}
                  </div>
      </div>
    </div>
  );
}
