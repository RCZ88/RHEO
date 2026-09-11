import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, Circle, X, Clock, ChevronDown, History, Brain } from 'lucide-react';
import { GlassCard, Skeleton } from '../components/ai';
import type { Goal } from '../services/GoalStore';

const statusIcons: Record<string, any> = {
  completed: CheckCircle2,
  dismissed: X,
  pending: Circle,
  'in-progress': Clock,
};

const statusColors: Record<string, string> = {
  completed: 'text-emerald-400',
  dismissed: 'text-zinc-600',
  pending: 'text-zinc-500',
  'in-progress': 'text-amber-400',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function GoalHistoryCard() {
  const [history, setHistory] = useState<Record<string, { goals: Goal[]; reviewSummary?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const days: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }
      const results: Record<string, { goals: Goal[]; reviewSummary?: string }> = {};
      for (const date of days) {
        const day = await window.deskflowAPI!.getGoals(date);
        if (day.goals?.length > 0) results[date] = { goals: day.goals, reviewSummary: day.reviewSummary };
      }
      setHistory(results);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    }
    setLoading(false);
  }

  function toggleExpand(date: string) {
    setExpanded(expanded === date ? null : date);
  }

  const doneCount = (goals: Goal[]) => goals.filter(g => g.status === 'completed').length;

  return (
    <GlassCard accent="amber" className="overflow-hidden">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/40 ring-1 ring-zinc-700/50 grid place-items-center">
          <History className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Goal History</h3>
          <p className="text-[10px] text-zinc-500">Last 7 days</p>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[34px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/8 ring-1 ring-red-500/15 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && Object.keys(history).length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-zinc-800/40 ring-1 ring-zinc-700/50 grid place-items-center mb-3">
            <Calendar className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No goal history</p>
          <p className="text-xs text-zinc-600 mt-1">Goals from the last 7 days will appear here.</p>
        </div>
      )}

      {!loading && !error && Object.keys(history).length > 0 && (
        <div className="space-y-2">
          {Object.entries(history).map(([date, entry], idx) => {
            const isOpen = expanded === date;
            const dc = doneCount(entry.goals);
            const total = entry.goals.length;
            return (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <button
                  onClick={() => toggleExpand(date)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-zinc-800/10 ring-1 ring-zinc-800/60 hover:ring-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300">{formatDate(date)}</span>
                    <span className="text-[10px] text-zinc-600">{dc}/{total}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <ChevronDown className={`w-3 h-3 text-zinc-600 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 pt-1 pb-2 pl-4">
                        {entry.goals.map(g => {
                          const Icon = statusIcons[g.status] || Circle;
                          const colorClass = statusColors[g.status] || 'text-zinc-500';
                          return (
                            <div key={g.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/5">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${colorClass}`} />
                              <span className="text-xs text-zinc-300 flex-1 truncate">{g.title}</span>
                              <span className="text-[10px] uppercase tracking-wider text-zinc-600 shrink-0">{g.category}</span>
                            </div>
                          );
                        })}
                      </div>
                      {entry.reviewSummary && (
                        <div className="mx-4 mb-2 rounded-lg px-3 py-2 bg-pink-500/5 ring-1 ring-pink-500/15">
                          <div className="flex items-center gap-1 mb-1">
                            <Brain className="w-2.5 h-2.5 text-pink-400" />
                            <span className="text-[9px] uppercase tracking-wider text-pink-400 font-medium">Review</span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{entry.reviewSummary}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
