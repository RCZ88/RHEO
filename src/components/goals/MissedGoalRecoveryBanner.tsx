import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { Goal } from '../../types/goals';

interface MissedGoalRecoveryBannerProps {
  missedGoals: Goal[];
  onRecover: (goalId: string, action: 'mark_late' | 'reschedule' | 'dismiss') => void;
  onDismiss: () => void;
}

export function MissedGoalRecoveryBanner({ missedGoals, onRecover, onDismiss }: MissedGoalRecoveryBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (missedGoals.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <AlertTriangle size={16} className="text-amber-400 shrink-0" />
        <span className="text-[12px] text-amber-300 font-medium flex-1">
          {missedGoals.length} goal{missedGoals.length !== 1 ? 's' : ''} missed
        </span>
        <span className="text-[11px] text-amber-400/60">
          {expanded ? 'Hide' : 'Review'}
        </span>
        {expanded ? <ChevronUp size={14} className="text-amber-400/60" /> : <ChevronDown size={14} className="text-amber-400/60" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {missedGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]">
                  <span className="text-[12px] text-zinc-300 flex-1 truncate">{goal.title}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{goal.date}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRecover(goal.id, 'mark_late')}
                      className="px-2 py-1 rounded-md text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                      title="Mark completed (late)"
                    >
                      <Clock size={10} className="inline mr-0.5" /> Late
                    </button>
                    <button
                      type="button"
                      onClick={() => onRecover(goal.id, 'reschedule')}
                      className="px-2 py-1 rounded-md text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
                      title="Move to today"
                    >
                      <RefreshCw size={10} className="inline mr-0.5" /> Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => onRecover(goal.id, 'dismiss')}
                      className="px-2 py-1 rounded-md text-[10px] text-zinc-400 bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/50 transition-colors"
                      title="Accept the miss"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={onDismiss}
                className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
              >
                Dismiss all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
