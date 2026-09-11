import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle2, Send, ChevronDown, Clock, Brain, ListChecks, TrendingUp, X, Circle, Cpu } from 'lucide-react';
import { GlassCard, IconButton, StatusDot, MOTION } from '../components/ai';
import type { Goal, GoalCategory } from '../services/GoalStore';

type Mode = 'morning' | 'in-progress' | 'review';

interface DailyPlanCardProps {
  goals: Goal[];
  mode: Mode;
  suggestions?: Array<{ title: string; category: GoalCategory }>;
  planGoals?: Array<{ title: string; targetSeconds?: number }>;
  review?: string | null;
  loading?: boolean;
  suggesting?: boolean;
  saving?: boolean;
  error?: string | null;
  onToggle: (goal: Goal) => void;
  onSuggest: () => void;
  onAccept: (suggestion: { title: string; category: GoalCategory }) => void;
  onDismiss: (suggestion: { title: string; category: GoalCategory }) => void;
  onFeedback: (message: string) => void;
  onRefreshPlan?: () => void;
  onConfigure?: () => void;
  providerBadge?: { label: string; color: string } | null;
}

const modeConfig: Record<Mode, { label: string; dotColor: 'amber' | 'emerald' | 'pink'; icon: any; accent: string }> = {
  morning:      { label: 'Morning', dotColor: 'amber', icon: Sparkles,    accent: 'amber' },
  'in-progress':{ label: 'Active',  dotColor: 'emerald', icon: Circle, accent: 'emerald' },
  review:       { label: 'Review',  dotColor: 'pink', icon: TrendingUp,  accent: 'pink' },
};

const catAccent: Record<string, { dot: string; badge: string }> = {
  work:     { dot: 'bg-violet-500',  badge: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20' },
  personal: { dot: 'bg-cyan-500',    badge: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20' },
  health:   { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20' },
  learning: { dot: 'bg-amber-500',   badge: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' },
};

export function DailyPlanCard({
  goals, mode, suggestions = [], planGoals = [], review,
  loading = false, suggesting = false, saving = false, error = null,
  onToggle, onSuggest, onAccept, onDismiss, onFeedback, onConfigure, providerBadge,
}: DailyPlanCardProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const mc = modeConfig[mode];

  const pending = useMemo(() => goals.filter(g => g.status !== 'completed' && g.status !== 'dismissed'), [goals]);
  const done = useMemo(() => goals.filter(g => g.status === 'completed'), [goals]);
  const progress = goals.length > 0 ? Math.round((done.length / goals.length) * 100) : 0;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  function handleSendFeedback() {
    if (!feedbackText.trim()) return;
    onFeedback(feedbackText.trim());
    setFeedbackText('');
  }

  return (
    <GlassCard accent={mc.accent as any} className="relative overflow-hidden">
      <div className="relative">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 ring-1 ring-zinc-700/60 flex items-center justify-center">
              <Brain className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">Daily Plan</h3>
                <StatusDot color={mc.dotColor} label={mc.label} />
                {providerBadge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${providerBadge.color}`}>
                    {providerBadge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {mode === 'morning' ? dateStr : `${done.length} of ${goals.length} \u00B7 ${progress}%`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {goals.length > 0 && (
              <svg width="40" height="40" className="shrink-0">
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(39 39 42)" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" fill="none"
                  stroke={progress === 100 ? '#34d399' : mc.accent === 'pink' ? '#ec4899' : mc.accent === 'amber' ? '#f59e0b' : '#34d399'}
                  strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={100.53}
                  strokeDashoffset={100.53 - (progress / 100) * 100.53}
                  transform="rotate(-90 20 20)"
                  className="transition-all duration-700 ease-out"
                />
                <text x="20" y="20" textAnchor="middle" dominantBaseline="central"
                  className="text-[10px] font-semibold" fill="currentColor">
                  {Math.round(progress)}%
                </text>
              </svg>
            )}
            {onConfigure && (
              <IconButton icon={Cpu} label="Configure provider" onClick={onConfigure} />
            )}
            {mode !== 'review' && (
              <button
                onClick={onSuggest}
                disabled={suggesting || saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
              >
                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {suggesting ? 'Generating...' : 'Suggest'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* From your plan section */}
      {planGoals.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <ListChecks className="w-3 h-3 text-zinc-500" />
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">From your plan</p>
          </div>
          <div className="space-y-1.5">
            {planGoals.map((pg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
                className="flex items-center gap-3 p-2.5 rounded-lg ring-1 ring-zinc-800/60 bg-zinc-800/10 hover:bg-zinc-800/30 transition-colors"
              >
                <div className="w-4 h-4 rounded ring-1 ring-zinc-600 shrink-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                </div>
                <span className="text-xs text-zinc-200 flex-1 leading-relaxed">{pg.title}</span>
                {pg.targetSeconds && (
                  <span className="text-[10px] text-zinc-500 font-mono">{(pg.targetSeconds / 60).toFixed(0)}m</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="w-3 h-3 text-pink-500" />
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">AI Suggestions</p>
          </div>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => {
              const ac = catAccent[s.category];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg ring-1 ring-pink-500/20 bg-pink-500/[0.03]"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ac ? ac.dot : 'bg-zinc-500'}`} />
                  <span className="text-xs text-zinc-200 flex-1 leading-relaxed">{s.title}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${ac ? ac.badge : 'bg-zinc-700/50 text-zinc-400'}`}>
                    {s.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onAccept(s)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      Accept
                    </button>
                    <IconButton icon={X} label="Dismiss suggestion" onClick={() => onDismiss(s)} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
            className="rounded-lg bg-red-500/8 ring-1 ring-red-500/15 p-3 mb-4"
          >
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            className="space-y-2 py-2"
          >
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 w-full rounded-lg bg-zinc-800/40 animate-pulse" />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && !error && mode === 'morning' && goals.length === 0 && suggestions.length === 0 && planGoals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Brain className="w-8 h-8 text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-400 mb-1">Plan your day</p>
          <p className="text-xs text-zinc-500 max-w-[220px]">Tap Suggest to let AI propose goals based on your context.</p>
          {onSuggest && (
            <button onClick={onSuggest} className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
              <Sparkles className="w-3 h-3" />
              Suggest Goals
            </button>
          )}
        </div>
      )}

      {/* Daily goals */}
      {!loading && !error && goals.length > 0 && (
        <div>
          {pending.length > 0 && (
            <div className="space-y-1">
              {pending.map((g, i) => {
                const ac = catAccent[g.category];
                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
                    className="flex items-start gap-3 p-3 rounded-lg ring-1 ring-zinc-800/60 bg-zinc-800/10 hover:bg-zinc-800/30 transition-all duration-150 group"
                  >
                    <button onClick={() => onToggle(g)} className="mt-0.5 shrink-0">
                      <Circle className="w-4.5 h-4.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ac && <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />}
                        <span className="text-sm text-zinc-200 leading-relaxed group-hover:text-zinc-100 transition-colors">{g.title}</span>
                      </div>
                      {g.description && (
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{g.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${ac ? ac.badge : 'bg-zinc-700/50 text-zinc-400'}`}>
                        {g.category}
                      </span>
                      {g.target?.targetSeconds && (
                        <span className="text-[10px] text-zinc-500 font-mono">{(g.target.targetSeconds / 60).toFixed(0)}m</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
              >
                <CheckCircle2 className="w-3 h-3" />
                Completed ({done.length})
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showCompleted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                    className="space-y-1 overflow-hidden"
                  >
                    {done.map(g => {
                      const ac = catAccent[g.category];
                      return (
                        <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg ring-1 ring-emerald-500/10 bg-emerald-500/[0.03]">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-sm text-zinc-500 line-through flex-1">{g.title}</span>
                          <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${ac ? ac.badge : 'bg-zinc-700/50 text-zinc-400'}`}>
                            {g.category}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {/* Review mode metrics */}
      {!loading && !error && mode === 'review' && pending.length === 0 && done.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.normal }}
          className="grid grid-cols-2 gap-3 mt-4"
        >
          <div className="p-3.5 rounded-xl bg-zinc-800/20 ring-1 ring-zinc-800/60">
            <TrendingUp className="w-4 h-4 text-emerald-400 mb-1.5" />
            <p className="text-lg font-bold text-zinc-100">{done.length}</p>
            <p className="text-[10px] text-zinc-500">goals completed</p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-800/20 ring-1 ring-zinc-800/60">
            <Clock className="w-4 h-4 text-zinc-400 mb-1.5" />
            <p className="text-lg font-bold text-zinc-100">{goals.filter(g => g.status === 'slipped').length}</p>
            <p className="text-[10px] text-zinc-500">carry over</p>
          </div>
        </motion.div>
      )}

      {/* Review summary */}
      {review && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.normal }}
          className="mt-4 p-3.5 rounded-xl bg-pink-500/[0.04] ring-1 ring-pink-500/15"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="w-3 h-3 text-pink-400" />
            <span className="text-[10px] uppercase tracking-wider text-pink-400 font-medium">Review</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{review}</p>
        </motion.div>
      )}

      {/* Feedback input */}
      <div className="mt-5 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFeedback(); } }}
            placeholder="How was your day?"
            className="w-full bg-zinc-800/40 ring-1 ring-zinc-800/60 rounded-lg pl-3 pr-8 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-pink-500/40 transition-colors"
          />
        </div>
        <button
          onClick={handleSendFeedback}
          disabled={!feedbackText.trim() || saving}
          className="grid place-items-center rounded-lg w-8 h-8 text-pink-400 hover:text-pink-300 hover:bg-pink-500/15 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Send feedback"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </GlassCard>
  );
}
