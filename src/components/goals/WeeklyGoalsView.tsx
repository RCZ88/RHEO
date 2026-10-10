import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Target, CheckCircle2, Clock, ChevronDown, ChevronUp, Flame, AlertTriangle } from 'lucide-react';
import type { Goal } from '../../types/goals';

interface WeeklyGoalsViewProps {
  weekGoals: Record<string, Goal[]>;
  weekDates: string[];
  selectedDate: string;
  onToggle: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: '#ec4899', personal: '#8b5cf6', health: '#34d399',
  learning: '#22d3ee', finance: '#fbbf24', relationships: '#fb7185',
};

export function WeeklyGoalsView({ weekGoals, weekDates, selectedDate, onToggle, onEdit, onDelete }: WeeklyGoalsViewProps) {
  const [expanded, setExpanded] = useState(true);

  // Flatten all goals for the week, deduplicate by id
  const allWeekGoals = useMemo(() => {
    const seen = new Set<string>();
    const goals: Goal[] = [];
    for (const date of weekDates) {
      for (const g of (weekGoals[date] || [])) {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          goals.push(g);
        }
      }
    }
    return goals;
  }, [weekGoals, weekDates]);

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, Goal[]> = {};
    for (const g of allWeekGoals) {
      const cat = g.category || 'work';
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    }
    return map;
  }, [allWeekGoals]);

  const doneCount = allWeekGoals.filter(g => g.status === 'done').length;
  const totalCount = allWeekGoals.length;

  if (totalCount === 0) return null;

  return (
    <div className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-amber-400" />
          <span className="text-[13px] font-semibold text-zinc-200">This Week's Goals</span>
          <span className="text-[10px] text-zinc-500 tabular-nums">{doneCount}/{totalCount} done</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-amber-400"
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {Object.entries(byCategory).map(([cat, goals]) => (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] || '#6b7280' }} />
                    <span className="text-[11px] font-medium text-zinc-400 capitalize">{cat}</span>
                    <span className="text-[9px] text-zinc-600 tabular-nums">
                      {goals.filter(g => g.status === 'done').length}/{goals.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {goals.map(goal => (
                      <div
                        key={goal.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                          goal.status === 'done'
                            ? 'bg-emerald-500/5 border border-emerald-500/10'
                            : 'bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border border-zinc-800/30 hover:border-zinc-700/40'
                        }`}
                      >
                        <button
                          onClick={() => onToggle(goal.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            goal.status === 'done'
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-zinc-600 hover:border-amber-400/60'
                          }`}
                        >
                          {goal.status === 'done' && <CheckCircle2 size={10} className="text-white" />}
                        </button>
                        <span className={`text-[12px] flex-1 truncate ${
                          goal.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-300'
                        }`}>
                          {goal.title}
                        </span>
                        {goal.target?.type === 'time' && goal.target?.targetSeconds && (
                          <span className="text-[9px] text-zinc-600 tabular-nums">
                            {Math.floor((goal.progressSeconds || 0) / 60)}m/{Math.floor((goal.target.targetSeconds) / 60)}m
                          </span>
                        )}
                        {goal.streak && goal.streak > 1 && (
                          <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                            <Flame size={8} />{goal.streak}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
