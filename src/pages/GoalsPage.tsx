import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Target, Plus, Flame, Sparkles, ArrowLeft, ChevronDown, ChevronUp,
  HeartHandshake, BookOpen, CheckCircle2, RefreshCw, TrendingUp, Zap,
  Flag,
} from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { CalendarStrip } from '../components/goals/CalendarStrip';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../components/goals/GoalCard';
import { GoalDetailModal } from '../components/goals/GoalDetailModal';
import { CriteriaBuilder, type CriteriaForm } from '../components/goals/CriteriaBuilder';
import { MissedGoalRecoveryBanner } from '../components/goals/MissedGoalRecoveryBanner';
import { getMissedGoals } from '../components/goals/GoalCompletionEngine';
import { HabitTracker } from '../components/goals/HabitTracker';
import { GoalAICoach } from '../components/goals/GoalAICoach';
import type { Goal, LongTermGoal, GoalCategory, GoalPeriod, GoalTarget } from '../components/dashboard/types';
import { confetti } from '../components/ui/confetti';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const defaultCriteria: CriteriaForm = {
  title: '', description: '', category: 'work', period: 'daily',
  targetType: 'completion', targetHours: 0, targetMinutes: 30,
  externalHours: 0, externalMinutes: 30,
  matchCategory: '', detectionEnabled: false, detectionMode: 'positive',
  detectionKeywords: '', detectionMinMinutes: 10,
  parentIds: [], links: [],
  externalActivityId: null,
  trackingMode: 'manual',
  completionLogic: { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, streakOnMiss: 'reset' },
  cadenceConfig: { type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7 },
  crossFeatureLink: null,
};

/**
 * `embedded` drops the page shell, the back arrow and the page-level heading.
 *
 * GoldPage now renders this component, so without it the Gold tab would contain
 * a whole second page inside it: its own scroll container, its own background,
 * and a second `<h1>Goals</h1>` directly under Gold's heading. Two page shells
 * nested in one tab is the same duplicate-surface problem the calendar had, and
 * it is invisible in a code review and obvious on screen. This matches the
 * convention `SchedulePage embedded` and `GoldPage embedded` already use.
 */
export default function GoalsPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  /* Goals whose `period` is 'longterm' — surfaced separately from day/weekly routines,
     and loaded across the whole range rather than for the selected date. */
  const [longtermPeriodGoals, setLongtermPeriodGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Goal>>({});
  const [newCriteria, setNewCriteria] = useState<CriteriaForm>(defaultCriteria);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCovenant, setShowCovenant] = useState(false);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);

  const api = window.deskflowAPI;

  /* THIS IS WHY A LONG-TERM GOAL "DOESN'T WORK".
     This used to call `getGoals(date)` — ONE day. The selected date is a
     filter, so a goal whose period is 'longterm' was saved against the day it
     was created on and then only ever reappeared on THAT day. Pick it a week
     later and it was simply gone, which reads as "long term goals don't work"
     rather than "this query is date-scoped".
     GoldPage already had the fix and says so in a comment: load the WHOLE goal
     set across a wide range, de-duped by id, and let the selected date affect
     only the strip highlight. Same rule here, plus the split below. */
  const loadGoals = useCallback(async (date: string) => {
    if (!api) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const api2 = api as any;
      if (api2.getGoalsBatch) {
        const end = new Date(date + 'T00:00:00');
        end.setFullYear(end.getFullYear() + 5);
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
        const res = await api2.getGoalsBatch('2000-01-01', endStr);
        const map = new Map<string, any>();
        for (const d of (res?.days || []) as any[]) {
          for (const g of (d.goals || []) as any[]) if (g?.id) map.set(g.id, g);
        }
        const all = [...map.values()];
        setGoals(all.filter((g: any) => g.period !== 'longterm'));
        setLongtermPeriodGoals(all.filter((g: any) => g.period === 'longterm'));
      } else {
        const result = await api.getGoals(date);
        setGoals(result.goals || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load goals');
    }
    setLoading(false);
  }, [api]);

  const loadLongTerm = useCallback(async () => {
    if (!api) return;
    try {
      const result = await api.getLongtermGoals();
      setLongTermGoals(result.goals || []);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { loadGoals(selectedDate); }, [selectedDate, loadGoals]);
  useEffect(() => { loadLongTerm(); }, [loadLongTerm]);

  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'done'), [goals]);
  const missedGoals = useMemo(() => getMissedGoals(goals, todayStr()), [goals]);
  const goalDateSet = useMemo(() => new Set(goals.map(g => g.date)), [goals]);

  const handleAdd = async () => {
    if (!newCriteria.title.trim() || !api) return;
    const targetSeconds = newCriteria.targetType === 'time'
      ? (newCriteria.targetHours * 3600) + (newCriteria.targetMinutes * 60)
      : newCriteria.targetType === 'external'
        ? (newCriteria.externalHours * 3600) + (newCriteria.externalMinutes * 60)
        : undefined;
    const goal: Goal = {
      id: uid(), title: newCriteria.title.trim(),
      description: newCriteria.description.trim() || undefined,
      category: newCriteria.category, period: newCriteria.period,
      target: {
        type: newCriteria.targetType,
        targetSeconds,
        maxExternalSeconds: newCriteria.targetType === 'external' ? targetSeconds : undefined,
        matchCategory: newCriteria.matchCategory || undefined,
      },
      status: 'active', date: selectedDate, source: 'manual',
      links: [], createdAt: new Date().toISOString(),
      parentId: newCriteria.parentIds[0] || undefined,
      parentIds: newCriteria.parentIds.length ? newCriteria.parentIds : undefined,
      externalActivityId: newCriteria.externalActivityId ?? null,
      trackingMode: newCriteria.trackingMode,
      completionLogic: newCriteria.completionLogic,
      cadenceConfig: newCriteria.cadenceConfig,
      crossFeatureLink: newCriteria.crossFeatureLink ?? null,
      detection: newCriteria.detectionEnabled ? {
        enabled: true, mode: newCriteria.detectionMode,
        keywords: newCriteria.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
        minMinutes: newCriteria.detectionMinMinutes,
      } : undefined,
    };
    try {
      await api.saveGoal(selectedDate, goal);
      setGoals(prev => [...prev, goal]);
      setIsAdding(false);
      setNewCriteria(defaultCriteria);
    } catch (e: any) {
      setError(e.message || 'Failed to save goal');
    }
  };

  const handleToggle = async (id: string) => {
    if (!api) return;
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    try {
      await api.saveGoal(selectedDate, {
        ...goal, status: newStatus,
        completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
      });
      setGoals(prev => prev.map(g => g.id === id ? { ...g, status: newStatus as Goal['status'], completedAt: newStatus === 'done' ? new Date().toISOString() : undefined } : g));
    } catch { /* revert handled by reload */ }
  };

  const handleDelete = async (id: string) => {
    if (!api) return;
    try {
      await api.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch { /* ignore */ }
  };

  const handleUpdate = async (id: string, patch: Partial<Goal>) => {
    if (!api) return;
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    try {
      await api.saveGoal(selectedDate, { ...goal, ...patch });
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
      setEditingId(null);
      setEditForm({});
    } catch { /* ignore */ }
  };

  const handleLongTermToggle = async (id: string) => {
    if (!api) return;
    const g = longTermGoals.find(l => l.id === id);
    if (!g) return;
    try {
      await api.saveGoal('', { ...g, status: g.status === 'done' ? 'active' : 'done' } as any);
      loadLongTerm();
    } catch { /* ignore */ }
  };

  const handleLongTermDelete = async (id: string) => {
    if (!api) return;
    try {
      await api.deleteGoal(id);
      setLongTermGoals(prev => prev.filter(l => l.id !== id));
    } catch { /* ignore */ }
  };

  const header = (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Target size={16} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-zinc-100">Goals</h1>
              <p className="text-[11px] text-zinc-500">Create, track, and manage your goals</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/life?tab=covenant')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[12px]"
          >
            <HeartHandshake size={13} />
            Covenant Streaks
          </button>
        </div>
  );

  /* Embedded: the heading belongs to Gold, so only the icon + line remain.
     Standalone: PageShell supplies the scroll container and background. */
  const body = (<>
        {/* Streak Overview */}
        {activeGoals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/10"
          >
            <Flame size={18} className="text-amber-400" />
            <span className="text-[12px] text-zinc-400">
              <span className="text-amber-300 font-medium">{activeGoals.length} active</span> goal{activeGoals.length !== 1 ? 's' : ''} today
              {completedGoals.length > 0 && (
                <> · <span className="text-emerald-400">{completedGoals.length} completed</span></>
              )}
            </span>
          </motion.div>
        )}

        {/* Calendar Strip */}
        <div className="p-3 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
          <CalendarStrip
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            goalDates={goalDateSet}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Sidebar — Streak / Stats / Long-term */}
          <div className="space-y-3">
            {/* Streak Summary */}
            <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
              <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-amber-500/20 via-amber-500/5 to-transparent" />
              <h3 className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
                <TrendingUp size={13} /> Momentum
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Flame size={20} className="text-amber-400" />
                  <span className="text-xl font-bold text-zinc-100 tabular-nums">{goals.filter(g => g.streak && g.streak > 1).length}</span>
                  <span className="text-[10px] text-zinc-500">with streak</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Active</span>
                  <span className="text-zinc-300">{activeGoals.length}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Completed</span>
                  <span className="text-emerald-400">{completedGoals.length}</span>
                </div>
              </div>
            </div>

            {/* Long-term Goals */}
            <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
              <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-cyan-500/20 via-cyan-500/5 to-transparent" />
              <h3 className="text-[12px] font-medium text-zinc-400 mb-3">Long-term Goals</h3>
              {longTermGoals.length === 0 ? (
                <p className="text-[11px] text-zinc-600 text-center py-4">No long-term goals yet</p>
              ) : (
                <div className="space-y-2">
                  {longTermGoals.filter(g => g.status !== 'done').map(g => (
                    <div key={g.id} className="flex items-center gap-2 text-[12px]">
                      <button
                        onClick={() => handleLongTermToggle(g.id)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          (g as any).status === 'done'
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-600 hover:border-violet-400/50'
                        }`}
                      >
                        {(g as any).status === 'done' && <CheckCircle2 size={10} className="text-white" />}
                      </button>
                      <span className="text-zinc-300 truncate">{g.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Habit Tracker */}
            <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
              <HabitTracker currentDate={selectedDate} />
            </div>

            {/* AI Goal Coach */}
            <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
              <h3 className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
                <Sparkles size={13} className="text-violet-400" /> AI Goal Coach
              </h3>
              <GoalAICoach
                onApply={async (proposal) => {
                  if (!api) return;
                  await api.goalAiApplyProposal(proposal.goalId, proposal.newConfig || {});
                  loadGoals(selectedDate);
                }}
                onDismiss={() => {}}
              />
            </div>

            {/* Covenant Quick Link */}
            <button
              onClick={() => setShowCovenant(!showCovenant)}
              className="w-full p-3 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] hover:border-amber-700/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <HeartHandshake size={14} className="text-amber-400" />
                <span className="text-[12px] font-medium text-zinc-300">Covenant Streaks</span>
                <ChevronDown size={12} className="text-zinc-500 ml-auto" />
              </div>
            </button>
          </div>

          {/* Main Goal List */}
          <div className="lg:col-span-2 space-y-3">
            {/* Date Label + Add Button */}
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-zinc-300">
                {selectedDate === todayStr() ? "Today's Goals" : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h2>
              <button
                onClick={() => { setIsAdding(!isAdding); setNewCriteria(defaultCriteria); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-colors text-[12px]"
              >
                <Plus size={13} />
                {isAdding ? 'Cancel' : 'Add Goal'}
              </button>
            </div>

            {/* Add Form */}
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-violet-500/20"
                >
                  <CriteriaBuilder
                    value={newCriteria}
                    onChange={setNewCriteria}
                    onSave={handleAdd}
                    onCancel={() => { setIsAdding(false); setNewCriteria(defaultCriteria); }}
                    longTermGoals={longTermGoals}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Missed Goals Recovery */}
            <MissedGoalRecoveryBanner
              missedGoals={missedGoals}
              onRecover={async (goalId, action) => {
                const goal = goals.find(g => g.id === goalId);
                if (!goal || !api) return;
                if (action === 'mark_late') {
                  await api.saveGoal(selectedDate, { ...goal, status: 'done', completedAt: new Date().toISOString() });
                  setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: 'done', completedAt: new Date().toISOString() } : g));
                } else if (action === 'reschedule') {
                  const today = todayStr();
                  await api.saveGoal(today, { ...goal, date: today });
                  setGoals(prev => prev.map(g => g.id === goalId ? { ...g, date: today } : g));
                } else {
                  await api.deleteGoal(goalId);
                  setGoals(prev => prev.filter(g => g.id !== goalId));
                }
              }}
              onDismiss={() => {}}
            />

            {/* LONG-TERM GOALS. A goal whose period is 'longterm' has no single
                day attached to it, so it is listed here instead of being mixed
                into the day-scoped routine list below. Before this existed these
                were created, saved, and then only visible on the exact date they
                were made on — the thing that reads as "long-term goals are
                broken". Timespan is still chosen in the same Add form. */}
            {!loading && !error && longtermPeriodGoals.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 pt-1" data-section="goals.longterm">
                  <Flag size={13} className="text-amber-400" aria-hidden />
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
                    Long-term goals
                  </h3>
                  <span className="text-[11px] text-zinc-500">{longtermPeriodGoals.filter(g => g.status !== 'done').length} active</span>
                </div>
                {longtermPeriodGoals.map(g => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    longTermGoals={longTermGoals}
                    onToggle={async () => {
                      if (!api) return;
                      const next = g.status === 'done' ? 'active' : 'done';
                      await api.saveGoal(g.date, { ...g, status: next as any });
                      loadGoals(selectedDate);
                    }}
                    onDelete={async () => {
                      if (!api) return;
                      await api.deleteGoal?.(g.id);
                      loadGoals(selectedDate);
                    }}
                    onEdit={() => { setEditingId(g.id); setEditForm(g); }}
                  />
                ))}
              </div>
            )}

            {/* Goal List */}
            {loading ? (
              <GoalCardSkeleton />
            ) : error ? (
              <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
            ) : activeGoals.length === 0 && !isAdding ? (
              <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
                <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} />
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {activeGoals.map(goal => (
                    <motion.div
                      key={goal.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      {editingId === goal.id ? (
                        <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
                          <div className="space-y-2">
                            <input
                              value={editForm.title || ''}
                              onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 text-[13px] text-zinc-200 focus:outline-none focus:border-violet-500/50"
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && handleUpdate(goal.id, editForm)}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdate(goal.id, editForm)}
                                disabled={!editForm.title?.trim()}
                                className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-[12px]"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditForm({}); }}
                                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-[12px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <GoalCard
                          goal={goal}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onEdit={(g) => { setEditingId(g.id); setEditForm({ ...g }); }}
                          onView={() => setDetailGoal(goal)}
                          longTermGoals={longTermGoals}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Completed Goals Section */}
            {completedGoals.length > 0 && (
              <div className="p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors w-full"
                >
                  {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  <span>{completedGoals.length} completed</span>
                </button>
                <AnimatePresence>
                  {showCompleted && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-1.5 mt-2"
                    >
                      {completedGoals.map(goal => (
                        <div key={goal.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] opacity-50 hover:opacity-80 transition-opacity">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-[12px] text-zinc-500 line-through flex-1">{goal.title}</span>
                          <button onClick={() => handleToggle(goal.id)} className="text-zinc-600 hover:text-zinc-400 p-1 rounded" title="Undo">
                            <RefreshCw size={10} />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
  </>);

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Target size={16} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-100">Goals</h2>
            <p className="text-[11px] text-zinc-500">Create, track, and manage your goals</p>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <PageShell page="goals">
      <div className="max-w-5xl mx-auto space-y-4">
        {header}
        {body}
      </div>
    {/* Goal detail — description, links, location. Reachable from every GoalCard
        via the eye button. Without this the whole modal is dead code. */}
    {detailGoal && (
      <GoalDetailModal
        goal={detailGoal}
        onClose={() => setDetailGoal(null)}
        onSave={async (_id, patch) => {
          if (!api) return;
          await api.saveGoal(selectedDate, patch);
          loadGoals(selectedDate);
        }}
        onDelete={async id => {
          if (!api) return;
          await api.deleteGoal?.(id);
          loadGoals(selectedDate);
        }}
        longTermGoals={longTermGoals.filter(g => g.status !== 'done')}
      />
    )}

    </PageShell>
  );
}
