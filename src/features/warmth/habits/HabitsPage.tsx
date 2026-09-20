// src/features/warmth/habits/HabitsPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Flame, Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp,
  CalendarDays, Calendar, NotebookPen, TrendingUp, ChevronLeft, ChevronRight,
  Sparkles, Lightbulb, Timer, Code2, Activity, Pencil, X, Wand2, Clock,
} from 'lucide-react';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import { WarmCard } from '../WarmCard';
import { HabitTracker } from '../../../components/goals/HabitTracker';
import { HierarchyTree } from '../../../components/goals/HierarchyTree';
import { ConnectionExplorer } from '../../../components/goals/ConnectionExplorer';
import { LifeRiver } from '../../../components/life-river/river';
import { WeeklyGoalsView } from '../../../components/goals/WeeklyGoalsView';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../../../components/goals/GoalCard';
import { CriteriaBuilder } from '../../../components/goals/CriteriaBuilder';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import { MissedGoalRecoveryBanner } from '../../../components/goals/MissedGoalRecoveryBanner';
import { getMissedGoals } from '../../../components/goals/GoalCompletionEngine';
import { GoalAICoach } from '../../../components/goals/GoalAICoach';
import { GoalLanguageParser } from '../../../components/goals/GoalLanguageParser';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import { confetti } from '../../../components/ui/confetti';
import { NumberTicker } from '../../../components/ui/number-ticker';
import { BorderBeam } from '../../../components/ui/border-beam';
import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper';
import type { Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';
import { loadCompletions } from '../../covenant/storage';

/* ═══════════════════ helpers ═══════════════════ */

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => toStr(new Date());

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toStr(d);
}
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return addDaysStr(dateStr, -((d.getDay() + 6) % 7));
}
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const a = new Date(todayStr() + 'T00:00:00').getTime();
  const b = new Date((dateStr || '') + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function prettyDate(dateStr: string): string {
  if (dateStr === todayStr()) return 'Today';
  if (dateStr === addDaysStr(todayStr(), -1)) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarSide = 'left' | 'right';

function useCalendarSide(): [CalendarSide, () => void] {
  const [side, setSide] = useState<CalendarSide>('right');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const api = (window as any).deskflowAPI;
        if (!api?.getPreferences) return;
        const prefs = await api.getPreferences();
        const stored = prefs?.['gold_calendar_side'];
        if (alive && stored?.schemaVersion === 1) { const v = stored.side; if (v === 'left' || v === 'right') setSide(v); }
      } catch { /* keep default */ }
    })();
    return () => { alive = false; };
  }, []);
  const toggle = useCallback(() => setSide(s => {
    const next = s === 'left' ? 'right' : 'left';
    try { (window as any).deskflowAPI?.setPreference?.('gold_calendar_side', { schemaVersion: 1, side: next }); } catch { /* ignore */ }
    return next;
  }), []);
  return [side, toggle];
}

interface DailyReflection {
  productiveSec: number;
  codingSec: number;
  goals: { total: number; completed: number };
  habits: { total: number; completed: number };
  reviewSummary: string | null;
}
const emptyReflection: DailyReflection = {
  productiveSec: 0, codingSec: 0,
  goals: { total: 0, completed: 0 },
  habits: { total: 0, completed: 0 },
  reviewSummary: null,
};

function covenantStreak(): number {
  try {
    const completions = loadCompletions();
    const dates = [...new Set(completions.map(c => c.date))];
    const set = new Set(dates);
    if (set.size === 0) return 0;
    let cursor = todayStr();
    if (!set.has(cursor)) cursor = addDaysStr(cursor, -1);
    let streak = 0;
    while (set.has(cursor)) { streak += 1; cursor = addDaysStr(cursor, -1); }
    return streak;
  } catch { return 0; }
}
function covenantDoneDates(): Set<string> {
  try {
    return new Set(loadCompletions().map(c => c.date));
  } catch { return new Set(); }
}

function buildPrompts(data: DailyReflection, streak: number): string[] {
  const prompts: string[] = [];
  const prod = formatTime(data.productiveSec);
  if (data.goals.completed === 0 && data.goals.total === 0 && data.productiveSec === 0 && streak === 0) {
    return ['Start with one thing — even small. What\'s the one goal that matters today?'];
  }
  if (data.goals.total > 0) {
    prompts.push(data.goals.completed === data.goals.total
      ? `You sealed all ${data.goals.total} goal${data.goals.total > 1 ? 's' : ''} — what felt most impactful?`
      : `${data.goals.completed}/${data.goals.total} goals done — what blocked the rest?`);
  }
  if (data.productiveSec > 0) {
    prompts.push(`You spent ${prod} in productive time today — where did it go?`);
  }
  if (data.habits.completed > 0 && data.habits.total > 0) {
    prompts.push(`Habits: ${data.habits.completed}/${data.habits.total} — which kept you honest?`);
  }
  if (streak > 0) prompts.push(`Covenant day ${streak} — what's the habit that holds the streak together?`);
  if (data.codingSec > 0) prompts.push(`You coded for ${formatTime(data.codingSec)} — something new or deep work?`);
  return prompts.slice(0, 4);
}

const isWeeklyish = (g: Goal) =>
  !!g.isHabit ||
  g.cadence === 'weekly' ||
  g.period === 'weekly' ||
  g.period === 'longterm';

export const CAT_META: Record<string, { label: string; dot: string }> = {
  work:          { label: 'Work',          dot: '#ec4899' },
  personal:      { label: 'Personal',      dot: '#8b5cf6' },
  health:        { label: 'Health',        dot: '#34d399' },
  learning:      { label: 'Learning',      dot: '#22d3ee' },
  finance:       { label: 'Finance',       dot: '#fbbf24' },
  relationships: { label: 'Relationships', dot: '#fb7185' },
};
export const catDot = (c: string) => (CAT_META[c] || CAT_META.work).dot;

export const defaultCriteria: CriteriaForm = {
  title: '', description: '', category: 'work', period: 'daily',
  targetType: 'completion', targetHours: 0, targetMinutes: 30,
  externalHours: 0, externalMinutes: 30,
  matchCategory: '',
  detectionEnabled: false, detectionMode: 'positive', detectionKeywords: '',
  detectionMinMinutes: 5, parentIds: [], links: [],
  externalActivityId: null,
  appUsage: { apps: [], groupAsFocus: false, focusGroupName: '' },
  trackingMode: 'manual',
  completionLogic: { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, partialCreditThreshold: 80, streakOnMiss: 'reset' },
  cadenceConfig: { type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7 },
  crossFeatureLink: null,
};

function goalToCriteria(g: Goal): CriteriaForm {
  return {
    title: g.title, description: g.description || '', category: g.category, period: g.period,
    targetType: g.target.type,
    targetHours: g.target.targetSeconds ? Math.floor(g.target.targetSeconds / 3600) : 0,
    targetMinutes: g.target.targetSeconds ? Math.floor((g.target.targetSeconds % 3600) / 60) : 30,
    externalHours: g.target.maxExternalSeconds ? Math.floor(g.target.maxExternalSeconds / 3600) : 0,
    externalMinutes: g.target.maxExternalSeconds ? Math.floor((g.target.maxExternalSeconds % 3600) / 60) : 30,
    matchCategory: g.target.matchCategory || '',
    detectionEnabled: g.detection?.enabled || false,
    detectionMode: g.detection?.mode || 'positive',
    detectionKeywords: g.detection?.keywords?.join(', ') || '',
    detectionMinMinutes: g.detection?.minMinutes || 5,
    parentIds: g.parentIds?.length ? g.parentIds : (g.parentId ? [g.parentId] : []),
    links: g.links || [],
    externalActivityId: g.externalActivityId ?? null,
    appUsage: {
      apps: (g.target?.matchApps ?? []).filter(Boolean),
      groupAsFocus: false,
      focusGroupName: '',
    },
    trackingMode: g.trackingMode || 'manual',
    completionLogic: g.completionLogic || { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, streakOnMiss: 'reset' },
    cadenceConfig: g.cadenceConfig || { type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7 },
    crossFeatureLink: g.crossFeatureLink ?? null,
  };
}

export function criteriaToGoal(c: CriteriaForm, date: string, existingId?: string): Goal {
  return {
    id: existingId || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: c.title.trim(),
    description: c.description.trim() || undefined,
    category: c.category,
    target: {
      type: c.targetType,
      targetSeconds: c.targetType === 'time' ? c.targetHours * 3600 + c.targetMinutes * 60 : undefined,
      maxExternalSeconds: c.targetType === 'external' ? c.externalHours * 3600 + c.externalMinutes * 60 : undefined,
      matchCategory: c.matchCategory || undefined,
      matchApps: c.targetType === 'app' ? c.appUsage?.apps ?? [] : undefined,
    },
    period: c.period, status: 'active', date, source: 'manual',
    links: c.links, progressSeconds: 0, createdAt: new Date().toISOString(),
    parentId: c.parentIds[0] || undefined,
    parentIds: c.parentIds.length ? c.parentIds : undefined,
    detection: c.detectionEnabled ? {
      enabled: true, mode: c.detectionMode,
      keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
      minMinutes: c.detectionMinMinutes,
    } : (c.appUsage?.apps?.length ? {
      enabled: true, mode: 'positive', keywords: c.appUsage.apps, minMinutes: 1,
    } : undefined),
    externalActivityId: c.externalActivityId ?? null,
    trackingMode: c.trackingMode,
    completionLogic: c.completionLogic,
    cadenceConfig: c.cadenceConfig,
    crossFeatureLink: c.crossFeatureLink ?? null,
  };
}

const GLASS = 'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]';

function StatPill({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string | number; accent: 'amber' | 'violet' | 'emerald' | 'cyan' | 'rose';
}) {
  const accentMap = {
    amber: 'text-amber-400', violet: 'text-violet-400', emerald: 'text-emerald-400',
    cyan: 'text-cyan-400', rose: 'text-rose-400',
  };
  return (
    <div className={`${GLASS} px-3 py-2.5 flex items-center gap-2`}>
      <span className={accentMap[accent]}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-zinc-100 tabular-nums">{value}</div>
        <div className="text-[10px] text-zinc-600">{label}</div>
      </div>
    </div>
  );
}

function DayRing({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="relative shrink-0">
      <AnimatedCircularProgressBar value={pct} size={46} strokeWidth={4} gaugePrimaryColor="#fbbf24" gaugeSecondaryColor="rgba(63,63,70,0.5)" />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-zinc-300 tabular-nums">{done}/{total}</span>
    </div>
  );
}

/* ═══════════════════ main component ═══════════════════ */

export function HabitsPage() {
  const api = (window as any).deskflowAPI;
  const [side, toggleSide] = useCalendarSide();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reviewSummary, setReviewSummary] = useState('');
  const [reflection, setReflection] = useState<DailyReflection>(emptyReflection);
  const [weekReflections, setWeekReflections] = useState<Record<string, DailyReflection>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCriteria, setNewCriteria] = useState<CriteriaForm>(defaultCriteria);
  const [editCriteria, setEditCriteria] = useState<CriteriaForm>(defaultCriteria);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLangParser, setShowLangParser] = useState(false);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);
  const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; createdAt: string; goalId?: string; scheduleId?: string; deadlineId?: string; parentTodoId?: string; dueDate?: string }[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [connectionEntity, setConnectionEntity] = useState<{ type: 'goal'; id: string; title: string } | null>(null);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [expandedHierarchy, setExpandedHierarchy] = useState<Set<string>>(new Set());
  const [hierarchyFilter, setHierarchyFilter] = useState<'all' | 'goals' | 'todos' | 'deadlines' | 'schedule'>('all');

  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* ── habits data ── */
  const habits = useMemo(() => goals.filter(g => !!g.isHabit), [goals]);
  const habitTracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const habitDoneCount = goals.filter(g => g.status === 'done' && !!g.isHabit).length;
  const habitTotalCount = goals.filter(g => !!g.isHabit).length;

  /* ── loading ── */
  const loadGoals = useCallback(async (_date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.getGoalsBatch('2000-01-01', addDaysStr(todayStr(), 120));
      const map = new Map<string, any>();
      for (const d of (res.days || []) as any[]) {
        for (const g of (d.goals || []) as any[]) {
          if (!g.id) continue;
          map.set(g.id, g);
        }
      }
      setGoals([...map.values()]);
    } catch (e: any) { setError(e?.message || 'Failed to load goals'); }
    finally { setLoading(false); }
  }, [api]);

  const loadWeek = useCallback(async (date: string) => {
    try {
      const mon = mondayOf(date);
      const res = await api.getGoalsBatch(mon, addDaysStr(mon, 6));
      setWeekGoals(res.days || {});
    } catch { /* non-critical */ }
  }, [api]);

  useEffect(() => {
    loadGoals(selectedDate);
    loadWeek(selectedDate);
    (async () => {
      try {
        const res = await api.getGoalReview(selectedDate);
        setReviewSummary(res?.review?.summary || '');
      } catch { setReviewSummary(''); }
    })();
    (async () => {
      try {
        const res = await api.getDailyReflection(selectedDate);
        if (res?.success) {
          setReflection({
            productiveSec: res.productiveSec || 0,
            codingSec: res.codingSec || 0,
            goals: res.goals || { total: 0, completed: 0 },
            habits: res.habits || { total: 0, completed: 0 },
            reviewSummary: res.reviewSummary || null,
          });
        }
      } catch { setReflection(emptyReflection); }
    })();
  }, [selectedDate, loadGoals, loadWeek, api]);

  const loadLongTerm = useCallback(async () => {
    try {
      const res = await api.getLongtermGoals();
      setLongTermGoals(res.goals || []);
    } catch { /* non-critical */ }
  }, [api]);

  useEffect(() => {
    loadLongTerm();
    (async () => {
      try { const res = await api.getReminders(); setReminders(res.reminders || []); } catch {}
    })();
    (async () => {
      try { const res = await api.getDeadlines({ days: 60 }); setDeadlines(res.deadlines || []); } catch {}
    })();
    (async () => {
      try { const res = await api.getSchedule(); setSchedule(res.entries || []); } catch {}
    })();
    (async () => {
      try { const res = await api.todoList?.(); if (res?.success) setTodos(res.todos || []); } catch {}
    })();
  }, [api, loadLongTerm]);

  /* ── CRUD ── */
  const handleAdd = async () => {
    if (!newCriteria.title.trim()) return;
    const goal = criteriaToGoal(newCriteria, selectedDate);
    setGoals(prev => [...prev, goal]);
    setIsAdding(false); setNewCriteria(defaultCriteria);
    try {
      await api.saveGoal(selectedDate, goal);
      confetti({ particleCount: 50, spread: 80, startVelocity: 35, colors: ['#fbbf24', '#f59e0b', '#34d399', '#a78bfa'] });
      loadGoals(selectedDate);
      loadWeek(selectedDate);
    } catch { setGoals(prev => prev.filter(g => g.id !== goal.id)); setError('Failed to save goal'); }
  };

  const handleToggle = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, status: newStatus as any, completedAt } : g)));
    if (newStatus === 'done') confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24'] });
    try { await api.saveGoal(selectedDate, { ...goal, status: newStatus, completedAt }); loadGoals(selectedDate); loadWeek(selectedDate); }
    catch { setGoals(prev => prev.map(g => (g.id === id ? goal : g))); }
  };

  const handleDelete = async (id: string) => {
    const removed = goals.find(g => g.id === id);
    setGoals(prev => prev.filter(g => g.id !== id));
    try { await api.deleteGoal(id); loadGoals(selectedDate); loadWeek(selectedDate); }
    catch { if (removed) setGoals(prev => [...prev, removed]); }
  };

  const handleEditStart = (goal: Goal) => { setEditingId(goal.id); setEditCriteria(goalToCriteria(goal)); };

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
        targetSeconds: editCriteria.targetType === 'time' ? editCriteria.targetHours * 3600 + editCriteria.targetMinutes * 60 : undefined,
        maxExternalSeconds: editCriteria.targetType === 'external' ? editCriteria.externalHours * 3600 + editCriteria.externalMinutes * 60 : undefined,
        matchCategory: editCriteria.matchCategory || undefined,
      },
      parentId: editCriteria.parentIds[0] || undefined,
      parentIds: editCriteria.parentIds.length ? editCriteria.parentIds : undefined,
      detection: editCriteria.detectionEnabled ? {
        enabled: true, mode: editCriteria.detectionMode,
        keywords: editCriteria.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
        minMinutes: editCriteria.detectionMinMinutes,
      } : undefined,
    };
    setGoals(prev => prev.map(g => (g.id === editingId ? updated : g)));
    setEditingId(null);
    try { await api.saveGoal(selectedDate, updated); loadGoals(selectedDate); loadWeek(selectedDate); }
    catch { setGoals(prev => prev.map(g => (g.id === editingId ? existing : g))); }
  };

  const handleToggleDay = async (goal: Goal) => {
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;
    setWeekGoals(prev => ({
      ...prev,
      [goal.date]: (prev[goal.date] || []).map(g => (g.id === goal.id ? { ...g, status: newStatus as any, completedAt } : g)),
    }));
    if (goal.date === selectedDate) {
      setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, status: newStatus as any, completedAt } : g)));
    }
    if (newStatus === 'done') confetti({ particleCount: 35, spread: 60, startVelocity: 28, colors: ['#fbbf24', '#34d399'] });
    try { await api.saveGoal(goal.date, { ...goal, status: newStatus, completedAt }); }
    catch { loadWeek(selectedDate); loadGoals(selectedDate); }
  };

  /* ── reminders ── */
  const createReminder = async (text: string, dueDate?: string) => {
    try {
      const res = await api.createReminder({ text, dueDate: dueDate || selectedDate });
      if (res.reminder) setReminders(prev => [...prev, { ...res.reminder, due_date: res.reminder.dueDate, created_at: new Date().toISOString() }]);
    } catch {}
  };
  const toggleReminder = async (id: string, done: boolean) => {
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, done } : r)));
    try { await api.toggleReminder(id, done); } catch {}
  };
  const deleteReminder = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    try { await api.deleteReminder(id); } catch {}
  };

  /* ── long-term goals ── */
  const handleLTGSave = useCallback(async (form: { title: string; description: string; category: GoalCategory; priority: number; deadline: string }, existing?: LongTermGoal) => {
    try {
      const res = await api.saveGoalsBatch([{
        id: existing?.id || `ltg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priority: form.priority,
        deadline: form.deadline || null,
        status: existing?.status || 'active',
        period: 'longterm',
        date: '2000-01-01',
        source: existing?.source || 'manual',
        links: existing?.links || [],
      }]);
      if (res?.success) { await loadLongTerm(); return true; }
      return false;
    } catch { return false; }
  }, [api, loadLongTerm]);

  const handleLTGDelete = useCallback(async (id: string) => {
    try {
      const res = await api.deleteGoal(id);
      if (res?.success) { setLongTermGoals(prev => prev.filter(g => g.id !== id)); return true; }
      return false;
    } catch { return false; }
  }, [api]);

  /* ── derived ── */
  const dailies = useMemo(() => goals.filter(g => !isWeeklyish(g) && g.status !== 'suggested'), [goals]);
  const activeDailies = dailies.filter(g => g.status !== 'done');
  const completedDailies = dailies.filter(g => g.status === 'done');
  const missedGoals = useMemo(() => getMissedGoals(goals, selectedDate), [goals, selectedDate]);
  const doneCount = goals.filter(g => g.status === 'done').length;
  const tracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const bestStreak = goals.reduce((mx, g) => Math.max(mx, g.streak || 0), 0);
  const weekDates = useMemo(() => {
    const mon = mondayOf(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDaysStr(mon, i));
  }, [selectedDate]);

  const goalConnections = useCallback((goal: Goal) => ({
    todoCount: todos.filter(todo => todo.goalId === goal.id).length,
    linkedSchedules: schedule.filter(entry => entry.goal_id === goal.id).map(entry => ({ id: entry.id, title: entry.title })),
    linkedDeadlines: deadlines.filter(deadline => deadline.goal_id === goal.id).map(deadline => ({ id: deadline.id, title: deadline.title })),
  }), [todos, schedule, deadlines]);

  const hierarchyData = useMemo(() => goals.map(goal => ({
    type: goal.isHabit ? 'habit' as const : 'goal' as const,
    id: goal.id,
    title: goal.title,
    children: [
      ...todos.filter(todo => todo.goalId === goal.id).map(todo => ({ type: 'todo' as const, id: todo.id, title: todo.text })),
      ...schedule.filter(entry => entry.goal_id === goal.id).map(entry => ({ type: 'schedule' as const, id: entry.id, title: entry.title })),
      ...deadlines.filter(deadline => deadline.goal_id === goal.id).map(deadline => ({ type: 'deadline' as const, id: deadline.id, title: deadline.title })),
    ],
  })), [goals, todos, schedule, deadlines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(weekDates.map(async d => {
          const res = await api.getDailyReflection(d);
          return { d, res };
        }));
        if (cancelled) return;
        const map: Record<string, DailyReflection> = {};
        for (const { d, res } of results) {
          if (res?.success) {
            map[d] = {
              productiveSec: res.productiveSec || 0,
              codingSec: res.codingSec || 0,
              goals: res.goals || { total: 0, completed: 0 },
              habits: res.habits || { total: 0, completed: 0 },
              reviewSummary: res.reviewSummary || null,
            };
          }
        }
        setWeekReflections(map);
      } catch { if (!cancelled) setWeekReflections({}); }
    })();
    return () => { cancelled = true; };
  }, [weekDates, api]);

  /* ── render ── */
  return (
    <div className="w-full max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="warmth-serif text-[24px] text-zinc-200 leading-tight">Habits &amp; Growth</h1>
          <p className="text-[12px] text-zinc-500 mt-1">Track your habits, review the week, and grow your routines</p>
        </div>
        <div className="flex items-center gap-3">
          <DayRing done={habitDoneCount} total={habitTotalCount} />
        </div>
      </div>

      {focusState?.isActive && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 mb-4"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
          {focusState.isBroken
            ? 'Focus session broken — progress paused'
            : `Focus session live — tracking ${activeGoalIds.length} goal${activeGoalIds.length !== 1 ? 's' : ''}`}
        </motion.div>
      )}

      {/* ═══ Two-column layout ═══ */}
      <div className={`flex flex-col lg:flex-row gap-4 ${side === "left" ? "lg:flex-row-reverse" : ""}`}>
        {/* LEFT: 2/3 — Habits + WeekReview + Hierarchy + ConnectionExplorer */}
        <div className="lg:flex-2 min-w-0 space-y-4">
          {/* Habit Tracker */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
              <Target size={13} className="text-pink-400" />
              Habit Tracker
              <span className="text-zinc-600 font-normal ml-1">{habitTotalCount} habits</span>
            </div>
            {loading ? (
              <div className="space-y-2"><div className="h-8 bg-zinc-800/50 rounded-lg animate-pulse" /><div className="h-8 bg-zinc-800/50 rounded-lg animate-pulse" /></div>
            ) : error ? (
              <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
            ) : habits.length === 0 ? (
              <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} />
            ) : (
              <HabitTracker currentDate={selectedDate} />
            )}
          </WarmCard>

          {/* WeekReview */}
          <WarmCard>
            <WeekReview weekDates={weekDates} reflections={weekReflections} />
          </WarmCard>

          {/* Goal Hierarchy */}
          <WarmCard ambient>
            <button onClick={() => setShowHierarchy(v => !v)} className="flex w-full items-center justify-between text-left text-[12px] font-semibold text-zinc-300">
              <span>Goal Hierarchy</span>
              <span className="text-[10px] font-normal text-zinc-600">{showHierarchy ? 'Hide tree' : 'Show linked work'}</span>
            </button>
            {showHierarchy && (
              <div className="mt-3 h-64 border-t border-zinc-800/50 pt-2">
                <HierarchyTree
                  roots={hierarchyData}
                  expanded={expandedHierarchy}
                  onToggle={id => setExpandedHierarchy(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}
                  onSelect={entity => {
                    const goal = goals.find(item => item.id === entity.id);
                    if (goal) setConnectionEntity({ type: 'goal', id: goal.id, title: goal.title });
                  }}
                  filter={hierarchyFilter}
                  onFilterChange={value => setHierarchyFilter(value || 'all')}
                />
              </div>
            )}
          </WarmCard>

          {/* Add Goal Form */}
          <AnimatePresence>
            {isAdding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <WarmCard ambient>
                  <CriteriaBuilder value={newCriteria} onChange={setNewCriteria} onSave={handleAdd}
                    onCancel={() => setIsAdding(false)} longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))} />
                </WarmCard>
              </motion.div>
            )}
          </AnimatePresence>

          {editingId && (
            <WarmCard ambient>
              <CriteriaBuilder value={editCriteria} onChange={setEditCriteria} onSave={handleEditSave}
                onCancel={() => { setEditingId(null); setEditCriteria(null); }}
                longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))} isEditing />
            </WarmCard>
          )}

          {/* Missed Goals Recovery */}
          <MissedGoalRecoveryBanner missedGoals={missedGoals}
            onRecover={async (goalId, action) => {
              const goal = goals.find(g => g.id === goalId);
              if (!goal) return;
              if (action === 'mark_late') { await api.saveGoal(selectedDate, { ...goal, status: 'done', completedAt: new Date().toISOString() }); }
              else if (action === 'reschedule') { await api.saveGoal(selectedDate, { ...goal, date: selectedDate }); }
              else { await api.saveGoal(selectedDate, { ...goal, date: selectedDate }); }
              loadGoals(selectedDate);
            }}
            onDismiss={async () => {
              for (const mg of missedGoals) { await api.saveGoal(selectedDate, { ...mg, date: selectedDate }); }
              loadGoals(selectedDate);
            }} />

          {/* Active Goals */}
          {loading ? <GoalCardSkeleton /> : error ? <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} /> : activeDailies.length === 0 && !isAdding ? (
            <WarmCard ambient><GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} /></WarmCard>
          ) : (
            <div className="space-y-1.5">
              {activeDailies.map(goal => (
                <div key={goal.id} className="relative">
                  {editingId === goal.id ? (
                    <WarmCard ambient>
                      <CriteriaBuilder value={editCriteria!} onChange={setEditCriteria!} onSave={handleEditSave}
                        onCancel={() => { setEditingId(null); setEditCriteria(null); }}
                        longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))} isEditing />
                    </WarmCard>
                  ) : (
                    <>
                      <GoalCard goal={goal} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEditStart}
                        longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                        {...goalConnections(goal)} onOpenConnections={g => setConnectionEntity({ type: 'goal', id: g.id, title: g.title })} />
                      {activeGoalIds.includes(goal.id) && goal.target.type === 'time' && (
                        <div className="absolute bottom-1.5 right-3 flex items-center gap-1 text-[10px] text-amber-400">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                          </span>
                          +{formatTime(getAccumulatedSeconds(goal.id))} live
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed Goals */}
          {completedDailies.length > 0 && (
            <div>
              <button onClick={() => setShowCompleted(p => !p)} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Sealed ({completedDailies.length})
              </button>
              <AnimatePresence>
                {showCompleted && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1.5 mt-2">
                    {completedDailies.map(goal => (
                      <GoalCard key={goal.id} goal={goal} onToggle={handleToggle} onDelete={handleDelete}
                        onEdit={handleEditStart} longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                        {...goalConnections(goal)} onOpenConnections={g => setConnectionEntity({ type: 'goal', id: g.id, title: g.title })} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* AI Goal Coach */}
          <WarmCard ambient>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={13} className="text-violet-400" />
              <span className="text-[13px] font-semibold text-zinc-200">AI Goal Coach</span>
            </div>
            <GoalAICoach onApply={async (proposal) => { await api.goalAiApplyProposal(proposal.goalId, proposal.newConfig || {}); loadGoals(selectedDate); }} onDismiss={() => {}} />
          </WarmCard>
        </div>

        {/* RIGHT: 1/3 — LifeRiver + HabitStats */}
        <div className="lg:w-1/3 min-w-0 space-y-4">
          {/* LifeRiver */}
          <WarmCard ambient>
            <LifeRiver />
          </WarmCard>

          {/* HabitStats */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
              <Flame size={13} className="text-pink-400" />
              Habit Stats
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Kept Today</div>
                <div className="text-[18px] font-semibold text-pink-400 tabular-nums">{habitDoneCount}</div>
              </div>
              <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Total</div>
                <div className="text-[18px] font-semibold text-zinc-300 tabular-nums">{habitTotalCount}</div>
              </div>
              <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tracked</div>
                <div className="text-[18px] font-semibold text-zinc-300 tabular-nums">{formatTime(habitTracked)}</div>
              </div>
              <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Streak</div>
                <div className="text-[18px] font-semibold text-amber-400 tabular-nums">{bestStreak}</div>
              </div>
            </div>
          </WarmCard>

          {/* Schedule Sync + Deadlines */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-pink-400" />
              Schedule & Deadlines
            </div>
            {loading ? (
              <div className="space-y-2"><div className="h-10 bg-zinc-800/50 rounded-lg animate-pulse" /><div className="h-10 bg-zinc-800/50 rounded-lg animate-pulse" /></div>
            ) : (
              <div className="space-y-1.5">
                {schedule.length === 0 && deadlines.length === 0 && (
                  <p className="text-[11px] text-zinc-600 text-center py-2">No schedule or deadlines yet</p>
                )}
                {schedule.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/30 text-[11px] text-zinc-400">
                    <Clock size={11} /> {entry.title}
                  </div>
                ))}
                {deadlines.map(dl => (
                  <div key={dl.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/30 text-[11px] text-zinc-400">
                    <CalendarDays size={11} /> {dl.title}
                  </div>
                ))}
              </div>
            )}
          </WarmCard>

          {/* Calendar Sidebar */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <Calendar size={13} className="text-pink-400" />
              Calendar
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-[8px] text-zinc-600 py-0.5">{d}</div>
              ))}
              {Array.from({ length: new Date(selectedDate + 'T00:00:00').getDate() - 1 }).map((_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: new Date(selectedDate + 'T00:00:00').getDate() }).map((_, i) => {
                const dateStr = `${selectedDate.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;
                const isToday = dateStr === todayStr();
                return (
                  <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                    className={`h-7 rounded-md text-[10px] tabular-nums transition-colors ${isToday ? 'bg-pink-500/15 text-pink-300 font-semibold' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </WarmCard>
        </div>
      </div>

      {/* Bottom full-width sections */}
      <ConnectionExplorer entity={connectionEntity} isOpen={!!connectionEntity} onClose={() => setConnectionEntity(null)} />
    </div>
  );
}
