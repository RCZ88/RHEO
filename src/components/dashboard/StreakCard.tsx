import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Calendar, Trophy, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { BorderBeam } from '../ui/border-beam';

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  completedDates: string[];
  categoryStreaks: Record<string, number>;
}

interface StreakCardProps {
  goals: any[];
  className?: string;
}

function calculateStreaks(goals: any[]): StreakData {
  const completedDates = new Set<string>();
  const categoryStreaks: Record<string, number> = {};

  goals.forEach(goal => {
    if (goal.status === 'done' && goal.completedAt) {
      const date = goal.completedAt.split('T')[0];
      completedDates.add(date);
      categoryStreaks[goal.category] = (categoryStreaks[goal.category] || 0) + 1;
    }
  });

  const sortedDates = Array.from(completedDates).sort().reverse();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    if (completedDates.has(checkDate.toISOString().split('T')[0])) {
      currentStreak++;
    } else if (i > 0) break;
  }

  let bestStreak = 0;
  let tempStreak = 0;
  sortedDates.reverse().forEach((date, index) => {
    if (index === 0) { tempStreak = 1; return; }
    const diff = (new Date(date).getTime() - new Date(sortedDates[index - 1]).getTime()) / 86400000;
    if (diff === 1) { tempStreak++; } else { bestStreak = Math.max(bestStreak, tempStreak); tempStreak = 1; }
  });
  bestStreak = Math.max(bestStreak, tempStreak);

  return { currentStreak, bestStreak, completedDates: Array.from(completedDates), categoryStreaks };
}

function getMilestone(streak: number) {
  if (streak >= 100) return { label: 'Legendary', icon: <Trophy size={10} />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  if (streak >= 30) return { label: 'On Fire', icon: <Flame size={10} />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
  if (streak >= 14) return { label: 'Unstoppable', icon: <Zap size={10} />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
  if (streak >= 7) return { label: 'Strong Start', icon: <TrendingUp size={10} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  return null;
}

export function StreakCard({ goals = [], className = '' }: StreakCardProps) {
  const [streaks, setStreaks] = useState<StreakData>({ currentStreak: 0, bestStreak: 0, completedDates: [], categoryStreaks: {} });

  useEffect(() => { setStreaks(calculateStreaks(goals)); }, [goals]);

  const milestone = getMilestone(streaks.currentStreak);
  const topCategories = Object.entries(streaks.categoryStreaks).sort(([, a], [, b]) => b - a).slice(0, 2);

  return (
    <div className={`relative rounded-xl overflow-hidden  ${className}`}>
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-orange-500/30 via-orange-500/10 to-transparent" />

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 right-0 w-24 h-24 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 70%)', filter: 'blur(16px)' }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {streaks.currentStreak >= 14 && <BorderBeam size={120} duration={15} colorFrom="#f97316" colorTo="#fb923c" />}

      <div className="relative z-10 p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Flame size={13} className="text-orange-400" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-200" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
              Streak
            </span>
          </div>
          {milestone && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${milestone.color} ${milestone.bg} border ${milestone.border}`}>
              {milestone.icon}
              {milestone.label}
            </span>
          )}
        </div>

        {/* Main streak display */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[36px] font-bold leading-none tracking-tight text-orange-400" style={{ fontFamily: "var(--dk-mono, 'JetBrains Mono', monospace)" }}>
            <NumberTicker value={streaks.currentStreak} delay={200} duration={800} />
          </span>
          <span className="text-[12px] text-zinc-500 font-medium" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
            day{streaks.currentStreak !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={11} className="text-emerald-400/70" />
            <span className="text-[11px] text-zinc-500" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>Best</span>
            <span className="text-[12px] font-semibold text-zinc-300" style={{ fontFamily: "var(--dk-mono, 'JetBrains Mono', monospace)" }}>
              {streaks.bestStreak}
            </span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-violet-400/70" />
            <span className="text-[11px] text-zinc-500" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>Done</span>
            <span className="text-[12px] font-semibold text-zinc-300" style={{ fontFamily: "var(--dk-mono, 'JetBrains Mono', monospace)" }}>
              {streaks.completedDates.length}
            </span>
          </div>
        </div>

        {/* Category chips */}
        {topCategories.length > 0 && (
          <div className="flex items-center gap-1.5">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/50 border border-zinc-700/30 text-[10px] text-zinc-400" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
                <span className="capitalize">{cat}</span>
                <span className="font-semibold text-zinc-300" style={{ fontFamily: "var(--dk-mono, 'JetBrains Mono', monospace)" }}>{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
