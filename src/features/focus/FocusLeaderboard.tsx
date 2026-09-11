import { useState, useMemo } from 'react';
import { Trophy, Medal, Award, Clock, Timer } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import type { FocusHistoryRow } from './focusHelpers';
import { cn } from '@/lib/utils';

type LeaderboardPeriod = 'today' | 'week' | 'all';

interface FocusLeaderboardProps {
  history: FocusHistoryRow[];
}

interface LeaderboardEntry {
  id: string;
  duration: number;
  mode: 'timer' | 'stopwatch';
  completedAt: Date;
  outcome: 'completed' | 'failed' | 'aborted';
}

const PERIOD_TABS = [
  { key: 'today' as const, label: 'Today' },
  { key: 'week' as const, label: 'Week' },
  { key: 'all' as const, label: 'All Time' },
] as const;

const RANK_ICONS = [
  { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { icon: Medal, color: 'text-zinc-300', bg: 'bg-zinc-300/10' },
  { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10' },
] as const;

function fmtDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FocusLeaderboard({ history }: FocusLeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');

  const leaderboardData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const filtered = history.filter(session => {
      const sessionDate = new Date(session.started_at);
      if (session.outcome !== 'completed') return false;
      switch (period) {
        case 'today': return sessionDate >= todayStart;
        case 'week': return sessionDate >= weekStart;
        case 'all': return true;
        default: return false;
      }
    });

    const sorted = [...filtered].sort((a, b) => (b.actual_sec || 0) - (a.actual_sec || 0));
    return sorted.slice(0, 5).map((session, index) => ({
      id: String(session.id),
      duration: session.actual_sec || session.planned_sec,
      mode: ((session as any).mode || 'timer') as 'timer' | 'stopwatch',
      completedAt: new Date(session.started_at),
      outcome: session.outcome,
    }));
  }, [history, period]);

  return (
    <GlassCard className="h-full bg-zinc-900/95 border-zinc-800/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Leaderboard
        </h3>
        <div className="flex flex-wrap justify-end gap-1">
          {PERIOD_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded transition-colors font-medium',
                period === tab.key
                  ? 'bg-yellow-400/15 text-yellow-400'
                  : 'bg-zinc-800/40 text-zinc-500 hover:bg-zinc-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <AnimatePresence mode="wait">
          {leaderboardData.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6"
            >
              <Trophy className="w-7 h-7 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No completed sessions yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">Start a focus session to appear here</p>
            </motion.div>
          ) : (
            <motion.div
              key={period}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-1"
            >
              {leaderboardData.map((entry, index) => {
                const rankStyle = RANK_ICONS[index] || RANK_ICONS[2];
                const RankIcon = rankStyle.icon;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center gap-2.5 p-2 rounded-lg transition-colors',
                      index === 0 ? 'bg-yellow-400/5 border border-yellow-400/15' : 'bg-zinc-800/20 hover:bg-zinc-800/40 border border-transparent'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', rankStyle.bg)}>
                      <RankIcon className={cn('w-3.5 h-3.5', rankStyle.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-200">
                          {fmtDuration(entry.duration)}
                        </span>
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                          entry.mode === 'stopwatch'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-clay-500/15 text-clay-300'
                        )}>
                          {entry.mode === 'stopwatch' ? 'Challenge' : 'Timer'}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {fmtTime(entry.completedAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
