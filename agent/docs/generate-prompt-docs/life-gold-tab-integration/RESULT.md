# Gold/Goals Tab — Full Implementation

Below are the two complete files: the new **`GoldPage.tsx`** and the modified **`LifePage.tsx`**.

---

## 1. `src/features/warmth/gold/GoldPage.tsx` (new file)

```tsx
// src/features/warmth/gold/GoldPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Flame, Plus, Bell, Trash2, CheckCircle2, ChevronDown,
  ChevronUp, TrendingUp, Clock, X,
} from 'lucide-react';
import { WarmCard } from '../WarmCard';
import { CalendarStrip } from '../../../components/goals/CalendarStrip';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../../../components/goals/GoalCard';
import { CriteriaBuilder } from '../../../components/goals/CriteriaBuilder';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import { confetti } from '../../../components/ui/confetti';
import type { Goal, LongTermGoal } from '../../../components/dashboard/types';

/* ── helpers ─────────────────────────────────────────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = todayStr();
  if (dateStr === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === yStr) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const defaultCriteria: CriteriaForm = {
  title: '',
  description: '',
  category: 'work',
  period: 'daily',
  targetType: 'completion',
  targetHours: 0,
  targetMinutes: 30,
  matchCategory: '',
  detectionEnabled: false,
  detectionMode: 'positive',
  detectionKeywords: '',
  detectionMinMinutes: 5,
  parentId: '',
  links: [],
};

function goalToCriteria(goal: Goal): CriteriaForm {
  return {
    title: goal.title,
    description: goal.description || '',
    category: goal.category,
    period: goal.period,
    targetType: goal.target.type,
    targetHours: goal.target.targetSeconds ? Math.floor(goal.target.targetSeconds / 3600) : 0,
    targetMinutes: goal.target.targetSeconds ? Math.floor((goal.target.targetSeconds % 3600) / 60) : 30,
    matchCategory: goal.target.matchCategory || '',
    detectionEnabled: goal.detection?.enabled || false,
    detectionMode: goal.detection?.mode || 'positive',
    detectionKeywords: goal.detection?.keywords?.join(', ') || '',
    detectionMinMinutes: goal.detection?.minMinutes || 5,
    parentId: goal.parentId || '',
    links: goal.links || [],
  };
}

function criteriaToGoal(c: CriteriaForm, date: string, existingId?: string): Goal {
  const id = existingId || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const targetSeconds = c.targetType === 'time'
    ? c.targetHours * 3600 + c.targetMinutes * 60
    : undefined;
  return {
    id,
    title: c.title.trim(),
    description: c.description.trim() || undefined,
    category: c.category,
    target: { type: c.targetType, targetSeconds, matchCategory: c.matchCategory || undefined },
    period: c.period,
    status: 'active',
    date,
    source: 'manual',
    links: c.links,
    progressSeconds: 0,
    createdAt: new Date().toISOString(),
    parentId: c.parentId || undefined,
    detection: c.detectionEnabled
      ? {
          enabled: true,
          mode: c.detectionMode,
          keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
          minMinutes: c.detectionMinMinutes,
        }
      : undefined,
  };
}

interface Reminder {
  id: string;
  text: string;
  due_date: string | null;
  goal_id: string | null;
  done: boolean;
  created_at: string;
}

/* ── sub-components ──────────────────────────────────────── */

function FocusIndicator({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
      </span>
      {label}
    </motion.div>
  );
}

function StatsSidebar({
  goals,
  longTermGoals,
  onToggleLongTerm,
}: {
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  onToggleLongTerm: (id: string) => void;
}) {
  const active = goals.filter(g => g.status === 'active').length;
  const completed = goals.filter(g => g.status === 'done').length;
  const bestStreak = goals.reduce((max, g) => Math.max(max, g.streak || 0), 0);
  const totalTracked = goals.reduce((sum, g) => sum + (g.progressSeconds || 0), 0);

  return (
    <WarmCard ambient className="space-y-4">
      {/* counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 rounded-lg bg-zinc-800/30">
          <div className="text-lg font-semibold text-zinc-300 tabular-nums">{active}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Active</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-zinc-800/30">
          <div className="text-lg font-semibold text-emerald-400 tabular-nums">{completed}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Completed</div>
        </div>
      </div>

      {/* streak + tracked time */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Flame size={14} className="text-amber-400" />
          <span className="text-[12px] text-zinc-400">Best streak</span>
        </div>
        <span className="text-[13px] font-semibold text-amber-400 tabular-nums">{bestStreak}d</span>
      </div>
      {totalTracked > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-zinc-500" />
            <span className="text-[12px] text-zinc-400">Tracked</span>
          </div>
          <span className="text-[13px] font-medium text-zinc-300 tabular-nums">{formatTime(totalTracked)}</span>
        </div>
      )}

      {/* long-term goals */}
      {longTermGoals.length > 0 && (
        <div className="border-t border-zinc-800/50 pt-3">
          <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
            <TrendingUp size={13} />
            Long-term Goals
          </div>
          <div className="space-y-1.5">
            {longTermGoals.map(ltg => (
              <button
                key={ltg.id}
                onClick={() => onToggleLongTerm(ltg.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-zinc-800/40 transition-colors group"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    (ltg.progress ?? 0) >= 100
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-600 group-hover:border-amber-400/50'
                  }`}
                >
                  {(ltg.progress ?? 0) >= 100 && <CheckCircle2 size={10} className="text-white" />}
                </span>
                <span
                  className={`text-[12px] truncate ${
                    (ltg.progress ?? 0) >= 100 ? 'text-zinc-500 line-through' : 'text-zinc-300'
                  }`}
                >
                  {ltg.title}
                </span>
                {ltg.progress != null && ltg.progress < 100 && (
                  <span className="ml-auto text-[10px] text-zinc-600 tabular-nums shrink-0">{ltg.progress}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </WarmCard>
  );
}

function RemindersSidebar({
  reminders,
  onCreate,
  onToggle,
  onDelete,
}: {
  reminders: Reminder[];
  onCreate: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    onCreate(text.trim());
    setText('');
  };

  return (
    <WarmCard className="border-amber-500/20">
      <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
        <Bell size={13} className="text-amber-400" />
        Reminders
      </div>

      {/* input */}
      <div className="flex items-center gap-1.5 mb-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add reminder…"
          className="flex-1 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim()}
          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* list */}
      {reminders.length === 0 ? (
        <p className="text-[11px] text-zinc-600 text-center py-2">No reminders</p>
      ) : (
        <div className="space-y-1">
          {reminders.map(r => (
            <div
              key={r.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/30 transition-colors"
            >
              <button
                onClick={() => onToggle(r.id, !r.done)}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  r.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-amber-400/50'
                }`}
              >
                {r.done && <CheckCircle2 size={9} className="text-white" />}
              </button>
              <span className={`flex-1 text-[12px] truncate ${r.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                {r.text}
              </span>
              {r.due_date && (
                <span className="text-[9px] text-zinc-600 shrink-0">{r.due_date.slice(5)}</span>
              )}
              <button
                onClick={() => onDelete(r.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </WarmCard>
  );
}

function ReviewSection({
  date,
  reviewSummary,
  onSave,
}: {
  date: string;
  reviewSummary: string;
  onSave: (summary: string) => void;
}) {
  const [text, setText] = useState(reviewSummary);
  const [editing, setEditing] = useState(false);
  const isPast = date < todayStr();

  useEffect(() => setText(reviewSummary), [reviewSummary]);

  if (!isPast && !reviewSummary) return null;

  return (
    <WarmCard className="mt-3">
      <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
        <Target size={13} className="text-amber-400" />
        Daily Review
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="How did today go? What went well? What to improve?"
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 resize-none transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onSave(text); setEditing(false); }}
              className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[11px] font-medium transition-colors"
            >
              Save Review
            </button>
            <button
              onClick={() => { setText(reviewSummary); setEditing(false); }}
              className="px-3 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 text-[11px] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="cursor-pointer"
        >
          {reviewSummary ? (
            <p className="text-[12px] text-zinc-400 whitespace-pre-wrap leading-relaxed">{reviewSummary}</p>
          ) : (
            <p className="text-[11px] text-zinc-600 italic">Click to write a review for this day…</p>
          )}
        </div>
      )}
    </WarmCard>
  );
}

/* ── main component ──────────────────────────────────────── */

interface GoldPageProps {
  embedded?: boolean;
}

export default function GoldPage({ embedded }: GoldPageProps) {
  const api = (window as any).deskflowAPI;

  /* core state */
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* CRUD form state */
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCriteria, setNewCriteria] = useState<CriteriaForm>(defaultCriteria);
  const [editCriteria, setEditCriteria] = useState<CriteriaForm>(defaultCriteria);
  const [showCompleted, setShowCompleted] = useState(false);

  /* sidebar state */
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reviewSummary, setReviewSummary] = useState('');
  const [goalDates, setGoalDates] = useState<Set<string>>(new Set());

  /* focus integration */
  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* ── data loading ─────────────────────────────────────── */

  const loadGoals = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getGoals(date);
      setGoals(res.goals || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadLongTerm = useCallback(async () => {
    try {
      const res = await api.getLongtermGoals();
      setLongTermGoals(res.goals || []);
    } catch { /* non-critical */ }
  }, [api]);

  const loadReminders = useCallback(async () => {
    try {
      const res = await api.getReminders();
      setReminders(res.reminders || []);
    } catch { /* non-critical */ }
  }, [api]);

  const loadReview = useCallback(async (date: string) => {
    try {
      const res = await api.getGoalReview(date);
      setReviewSummary(res?.review?.summary || res?.review?.review_summary || '');
    } catch {
      setReviewSummary('');
    }
  }, [api]);

  const loadGoalDates = useCallback(async (center: string) => {
    try {
      const d = new Date(center + 'T00:00:00');
      const start = new Date(d); start.setDate(start.getDate() - 14);
      const end = new Date(d); end.setDate(end.getDate() + 14);
      const fmt = (dt: Date) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const res = await api.getGoalsBatch(fmt(start), fmt(end));
      setGoalDates(new Set(Object.keys(res.days || {})));
    } catch { /* non-critical */ }
  }, [api]);

  /* initial + date-change loads */
  useEffect(() => {
    loadGoals(selectedDate);
    loadReview(selectedDate);
    loadGoalDates(selectedDate);
  }, [selectedDate, loadGoals, loadReview, loadGoalDates]);

  useEffect(() => {
    loadLongTerm();
    loadReminders();
  }, [loadLongTerm, loadReminders]);

  /* ── CRUD handlers ────────────────────────────────────── */

  const handleAdd = async () => {
    if (!newCriteria.title.trim()) return;
    const goal = criteriaToGoal(newCriteria, selectedDate);
    /* optimistic */
    setGoals(prev => [...prev, goal]);
    setIsAdding(false);
    setNewCriteria(defaultCriteria);
    try {
      await api.saveGoal(selectedDate, goal);
      confetti({ particleCount: 50, spread: 80, startVelocity: 35, colors: ['#fbbf24', '#f59e0b', '#34d399', '#a78bfa'] });
    } catch {
      setGoals(prev => prev.filter(g => g.id !== goal.id));
      setError('Failed to save goal');
    }
  };

  const handleToggle = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;
    /* optimistic */
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, status: newStatus as any, completedAt } : g)));
    if (newStatus === 'done') {
      confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24'] });
    }
    try {
      await api.saveGoal(selectedDate, { ...goal, status: newStatus, completedAt });
    } catch {
      setGoals(prev => prev.map(g => (g.id === id ? goal : g)));
    }
  };

  const handleDelete = async (id: string) => {
    const removed = goals.find(g => g.id === id);
    /* optimistic */
    setGoals(prev => prev.filter(g => g.id !== id));
    try {
      await api.deleteGoal(id);
    } catch {
      if (removed) setGoals(prev => [...prev, removed]);
    }
  };

  const handleEditStart = (goal: Goal) => {
    setEditingId(goal.id);
    setEditCriteria(goalToCriteria(goal));
  };

  const handleEditSave = async () => {
    if (!editingId || !editCriteria.title.trim()) return;
    const existing = goals.find(g => g.id === editingId);
    if (!existing) return;
    const updated: Goal = {
      ...existing,
      title: editCriteria.title.trim(),
      description: editCriteria.description.trim() || undefined,
      category: editCriteria.category,
      period: editCriteria.period,
      target: {
        type: editCriteria.targetType,
        targetSeconds: editCriteria.targetType === 'time'
          ? editCriteria.targetHours * 3600 + editCriteria.targetMinutes * 60
          : undefined,
        matchCategory: editCriteria.matchCategory || undefined,
      },
      parentId: editCriteria.parentId || undefined,
      detection: editCriteria.detectionEnabled
        ? {
            enabled: true,
            mode: editCriteria.detectionMode,
            keywords: editCriteria.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
            minMinutes: editCriteria.detectionMinMinutes,
          }
        : undefined,
    };
    /* optimistic */
    setGoals(prev => prev.map(g => (g.id === editingId ? updated : g)));
    setEditingId(null);
    try {
      await api.saveGoal(selectedDate, updated);
    } catch {
      setGoals(prev => prev.map(g => (g.id === editingId ? existing : g)));
    }
  };

  const handleToggleLongTerm = async (id: string) => {
    setLongTermGoals(prev =>
      prev.map(l => (l.id === id ? { ...l, progress: (l.progress ?? 0) >= 100 ? 0 : 100 } : l)),
    );
    const ltg = longTermGoals.find(l => l.id === id);
    if (ltg) {
      const newProgress = (ltg.progress ?? 0) >= 100 ? 0 : 100;
      try {
        await api.saveGoal(selectedDate, { ...ltg, progress: newProgress });
      } catch { /* revert silently */ }
    }
  };

  /* ── reminder handlers ────────────────────────────────── */

  const handleCreateReminder = async (text: string) => {
    try {
      const res = await api.createReminder({ text, dueDate: selectedDate });
      if (res.reminder) setReminders(prev => [...prev, res.reminder]);
    } catch { /* non-critical */ }
  };

  const handleToggleReminder = async (id: string, done: boolean) => {
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, done } : r)));
    try {
      await api.updateReminder(id, { done });
    } catch { /* revert */ }
  };

  const handleDeleteReminder = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    try {
      await api.deleteReminder(id);
    } catch { /* non-critical */ }
  };

  /* ── review handler ───────────────────────────────────── */

  const handleSaveReview = async (summary: string) => {
    setReviewSummary(summary);
    try {
      await api.saveGoalReview(selectedDate, summary);
    } catch { /* non-critical */ }
  };

  /* ── derived data ─────────────────────────────────────── */

  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'done'), [goals]);

  /* ── render ───────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* calendar strip */}
      <CalendarStrip
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        goalDates={goalDates}
      />

      {/* focus indicator */}
      <AnimatePresence>
        {focusState?.isActive && (
          <FocusIndicator
            label={
              focusState.isBroken
                ? 'Focus session broken — progress paused'
                : `Focus session active — tracking ${activeGoalIds.length} goal${activeGoalIds.length !== 1 ? 's' : ''}`
            }
          />
        )}
      </AnimatePresence>

      {/* main layout: sidebar + goals */}
      <div className="flex gap-4 items-start">
        {/* ── sidebar ── */}
        <div className="w-[240px] shrink-0 space-y-3 hidden lg:block">
          <StatsSidebar
            goals={goals}
            longTermGoals={longTermGoals}
            onToggleLongTerm={handleToggleLongTerm}
          />
          <RemindersSidebar
            reminders={reminders}
            onCreate={handleCreateReminder}
            onToggle={handleToggleReminder}
            onDelete={handleDeleteReminder}
          />
        </div>

        {/* ── goal list ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* header row */}
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-zinc-300">
              {prettyDate(selectedDate)}
              <span className="text-zinc-600 font-normal ml-2 text-[12px]">
                {activeGoals.length} active · {completedGoals.length} done
              </span>
            </h2>
            <button
              onClick={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-[12px] font-medium transition-colors"
            >
              <Plus size={13} />
              Add Goal
            </button>
          </div>

          {/* add form */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <WarmCard ambient>
                  <CriteriaBuilder
                    value={newCriteria}
                    onChange={setNewCriteria}
                    onSave={handleAdd}
                    onCancel={() => setIsAdding(false)}
                    longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                  />
                </WarmCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* loading / error / empty / list */}
          {loading ? (
            <GoalCardSkeleton />
          ) : error ? (
            <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
          ) : goals.length === 0 ? (
            <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} />
          ) : (
            <>
              {/* active goals */}
              <div className="space-y-2">
                {activeGoals.map(goal => (
                  <div key={goal.id}>
                    {editingId === goal.id ? (
                      <WarmCard ambient>
                        <CriteriaBuilder
                          value={editCriteria}
                          onChange={setEditCriteria}
                          onSave={handleEditSave}
                          onCancel={() => setEditingId(null)}
                          longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                          isEditing
                        />
                      </WarmCard>
                    ) : (
                      <div className="relative">
                        <GoalCard
                          goal={goal}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onEdit={handleEditStart}
                          longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                        />
                        {/* live focus progress overlay */}
                        {activeGoalIds.includes(goal.id) && goal.target.type === 'time' && (
                          <div className="absolute bottom-1 right-3 flex items-center gap-1 text-[10px] text-amber-400">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                            </span>
                            +{formatTime(getAccumulatedSeconds(goal.id))} live
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* completed section */}
              {completedGoals.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowCompleted(prev => !prev)}
                    className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Completed ({completedGoals.length})
                  </button>
                  <AnimatePresence>
                    {showCompleted && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-2 mt-2"
                      >
                        {completedGoals.map(goal => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onEdit={handleEditStart}
                            longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {/* review section */}
          <ReviewSection
            date={selectedDate}
            reviewSummary={reviewSummary}
            onSave={handleSaveReview}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 2. `src/features/warmth/LifePage.tsx` (modified)

Only the **changed lines** are annotated with `// ← NEW` or `// ← CHANGED`. Everything else is identical to the original.

```tsx
// src/features/warmth/LifePage.tsx (full source — modified)
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartHandshake, Images, Target, Calendar, ListChecks, Flame } from 'lucide-react';
import CovenantPage from '../covenant/CovenantPage';
import MemoriesPage from '../memories/MemoriesPage';
import GoldPage from './gold/GoldPage';                                        // ← NEW

const TABS = [
  { key: 'covenant', label: 'Covenant', icon: HeartHandshake, accent: '#e8866b' },
  { key: 'memories', label: 'Memories', icon: Images, accent: '#6fb38f' },
  { key: 'gold', label: 'Gold', icon: Target, accent: '#fbbf24' },            // ← NEW
] as const;

type TabKey = typeof TABS[number]['key'];

const crossfade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

const pillTransition = { type: 'spring' as const, stiffness: 400, damping: 32 };

export default function LifePage() {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'memories' || tab === 'covenant' || tab === 'gold') return tab as TabKey;  // ← CHANGED
    } catch { /* ignore */ }
    return 'covenant';
  });

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  }, [activeTab]);

  const activeConfig = TABS.find(t => t.key === activeTab) || TABS[0];
  const iconWrapStyle = { background: `${activeConfig.accent}22` };
  const iconStyle = { color: activeConfig.accent };

  return (
    <div className="flex flex-col h-full" data-page={activeTab}>
      <div className="sticky top-0 z-30 -mx-5 px-5 bg-zinc-900/20 backdrop-blur-md border-b border-zinc-800/50">
        <div className="flex items-center gap-1 py-2">
          <div className="h-9 w-9 rounded-xl grid place-items-center mr-2" style={iconWrapStyle}>
            <activeConfig.icon className="w-5 h-5" style={iconStyle} />
          </div>
          <div className="flex gap-1 bg-zinc-800/50 p-0.5 rounded-lg">
            {TABS.map(tab => {
              const pillStyle = { background: `${tab.accent}22`, border: `1px solid ${tab.accent}40` };
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    activeTab === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="life-tab-pill"
                      className="absolute inset-0 rounded-md"
                      style={pillStyle}
                      transition={pillTransition}
                    />
                  )}
                  <tab.icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10 font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'covenant' && (
            <motion.div
              key="covenant"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="max-w-3xl mx-auto"
            >
              <CovenantPage embedded />
            </motion.div>
          )}
          {activeTab === 'memories' && (
            <motion.div
              key="memories"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="max-w-4xl mx-auto"
            >
              <MemoriesPage embedded />
            </motion.div>
          )}
          {activeTab === 'gold' && (                                          /* ← NEW block */
            <motion.div
              key="gold"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="max-w-5xl mx-auto"
            >
              <GoldPage embedded />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

---

## What was built — summary

| Requirement | Where |
|---|---|
| **Third "Gold" tab** with amber `#fbbf24` accent, `Target` icon | `LifePage.tsx` TABS array + render block |
| **URL param** `?tab=gold` support | `useState` initializer check |
| **CalendarStrip** date picker with goal-date dots | `GoldPage` → `<CalendarStrip>` + `getGoalsBatch` |
| **Full CRUD** — add / edit / delete / toggle | `handleAdd`, `handleEditSave`, `handleDelete`, `handleToggle` with optimistic updates |
| **CriteriaBuilder** form for add & edit | Inline `<CriteriaBuilder>` in WarmCard |
| **GoalCard** list with confetti on complete | Reused directly; confetti colors include amber |
| **Stats sidebar** — active/completed counts, streak, tracked time | `StatsSidebar` sub-component in `WarmCard ambient` |
| **Long-term goals** sidebar with toggle | Loaded via `getLongtermGoals`, rendered in `StatsSidebar` |
| **Reminders** sidebar — create / toggle / delete | `RemindersSidebar` sub-component, amber border accent |
| **Focus session integration** | `useFocusGoals(goals)` hook; `FocusIndicator` banner; live `+Xm` overlay on matching goals |
| **Daily review** section | `ReviewSection` — loads/saves via `getGoalReview` / `saveGoalReview` |
| **Loading / error / empty states** | `GoalCardSkeleton`, `GoalErrorState`, `GoalEmptyState` |
| **Warmth design system** | `WarmCard ambient`, warmth tokens, `rounded-xl`, glass layers, dark-only |
| **No backend changes** | All IPC via existing `window.deskflowAPI` bindings |
| **No new components** | Reuses `CalendarStrip`, `GoalCard`, `CriteriaBuilder`, `WarmCard`, `confetti`, skeletons, empty/error states |