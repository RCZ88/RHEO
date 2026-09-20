// ============================================================
// DeskFlow Dashboard — StreakBadge
// Skill: MCP (Trophy UI pattern) — gamified streak display
// Sources: Trophy UI streak-badge + ReactBits CountUp pattern
// ============================================================

import { motion } from 'framer-motion';
import { Flame, Zap } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;
  longestStreak?: number;
  size?: 'sm' | 'md' | 'lg';
  showCalendar?: boolean;
  activeDays?: boolean[]; // last 7 days, true = active
}

export function StreakBadge({
  streak,
  longestStreak,
  size = 'md',
  showCalendar = true,
  activeDays = [],
}: StreakBadgeProps) {
  const sizeClasses = {
    sm: { container: 'px-2 py-1 gap-1', icon: 12, text: 'text-[11px]', dot: 'w-1 h-1' },
    md: { container: 'px-2.5 py-1.5 gap-1.5', icon: 14, text: 'text-[13px]', dot: 'w-1.5 h-1.5' },
    lg: { container: 'px-3 py-2 gap-2', icon: 18, text: 'text-[15px]', dot: 'w-2 h-2' },
  };
  const s = sizeClasses[size];

  const isHot = streak >= 7;
  const isOnFire = streak >= 14;

  // Default last 7 days if not provided
  const days = activeDays.length === 7 ? activeDays : [true, true, true, false, true, true, true];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`inline-flex flex-col items-center ${s.container} rounded-xl bg-amber-500/[0.08] border border-amber-500/20`}
    >
      <div className="flex items-center gap-1.5">
        <motion.div
          animate={isOnFire ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : {}}
          transition={isOnFire ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <Flame
            size={s.icon}
            className={isHot ? 'text-amber-400' : 'text-amber-500/60'}
            strokeWidth={isOnFire ? 2.5 : 2}
          />
        </motion.div>
        <span className={`${s.text} font-bold text-amber-400 font-mono tabular-nums`}>
          {streak}
        </span>
        <span className={`${s.text} text-amber-500/60`}>day streak</span>
        {isHot && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            <Zap size={s.icon - 2} className="text-amber-300" fill="currentColor" />
          </motion.div>
        )}
      </div>

      {showCalendar && (
        <div className="flex items-center gap-[3px] mt-1.5">
          {days.map((active, i) => (
            <div key={i} className="flex flex-col items-center gap-[2px]">
              <motion.div
                initial={active ? { scale: 0 } : { scale: 1 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 400 }}
                className={`${s.dot} rounded-full ${
                  active
                    ? 'bg-amber-400'
                    : 'bg-zinc-700/50'
                }`}
              />
              <span className="text-[8px] text-zinc-700 font-medium">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      )}

      {longestStreak && longestStreak > streak && (
        <span className="text-[9px] text-zinc-600 mt-1">
          Best: {longestStreak}d
        </span>
      )}
    </motion.div>
  );
}
