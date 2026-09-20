// src/features/warmth/schedule/SchedulePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CalendarDays, Calendar, Clock, Target, Flame, X,
} from 'lucide-react';
import { WarmCard } from '../WarmCard';
import { ScheduleCard } from '../../../pages/dashboard/ScheduleCard';
import { CalendarStrip } from '../../../components/goals/CalendarStrip';
import { TodoList } from '../../../components/goals/TodoList';
import { ScheduleSyncCard } from '../../../components/dashboard/ScheduleSyncCard';
import { DeadlinesCard } from '../../../components/dashboard/DeadlinesCard';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import type { Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';

/* ── daily reflection (hard stats) ── */
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => toStr(new Date())

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

interface DailyReflection {
  productiveSec: number; codingSec: number;
  goals: { total: number; completed: number };
  habits: { total: number; completed: number };
  reviewSummary: string | null;
}
const emptyReflection: DailyReflection = { productiveSec: 0, codingSec: 0, goals: { total: 0, completed: 0 }, habits: { total: 0, completed: 0 }, reviewSummary: null };

/* covenant */
function covenantStreak(): number {
  try { const completions = loadCompletions(); const dates = [...new Set(completions.map(c => c.date))]; const set = new Set(dates); if (!set.size) return 0; let cursor = todayStr(); if (!set.has(cursor)) cursor = addDaysStr(cursor, -1); let streak = 0; while (set.has(cursor)) { streak += 1; cursor = addDaysStr(cursor, -1); } return streak; } catch { return 0; }
}
function covenantDoneDates(): Set<string> {
  try { return new Set(loadCompletions().map(c => c.date)); } catch { return new Set(); }
}
function buildPrompts(data: DailyReflection, streak: number): string[] {
  const prompts: string[] = []; const prod = formatTime(data.productiveSec);
  if (data.goals.completed === 0 && data.goals.total === 0 && data.productiveSec === 0 && streak === 0) return ['Start with one thing — even small. What\'s the one goal that matters today?'];
  if (data.goals.total > 0) prompts.push(data.goals.completed === data.goals.total ? `You sealed all ${data.goals.total} goal${data.goals.total > 1 ? 's' : ''} — what felt most impactful?` : `${data.goals.completed}/${data.goals.total} goals done — what blocked the rest?`);
  if (data.productiveSec > 0) prompts.push(`You spent ${prod} in productive time today — where did it go?`);
  if (data.habits.completed > 0 && data.habits.total > 0) prompts.push(`Habits: ${data.habits.completed}/${data.habits.total} — which kept you honest?`);
  if (streak > 0) prompts.push(`Covenant day ${streak} — what's the habit that holds the streak together?`);
  if (data.codingSec > 0) prompts.push(`You coded for ${formatTime(data.codingSec)} — something new or deep work?`);
  return prompts.slice(0, 4);
}

const isWeeklyish = (g: Goal) => !!g.isHabit || g.cadence === 'weekly' || g.period === 'weekly' || g.period === 'longterm';

export const CAT_META: Record<string, { label: string; dot: string }> = {
  work: { label: 'Work', dot: '#ec4899' }, personal: { label: 'Personal', dot: '#8b5cf6' },
  health: { label: 'Health', dot: '#34d399' }, learning: { label: 'Learning', dot: '#22d3ee' },
  finance: { label: 'Finance', dot: '#fbbf24' }, relationships: { label: 'Relationships', dot: '#fb7185' },
};
export const catDot = (c: string) => (CAT_META[c] || CAT_META.work).dot;

export const defaultCriteria: CriteriaForm = {
  title: '', description: '', category: 'work', period: 'daily', targetType: 'completion', targetHours: 0, targetMinutes: 30,
  externalHours: 0, externalMinutes: 30, matchCategory: '', detectionEnabled: false, detectionMode: 'positive', detectionKeywords: '',
  detectionMinMinutes: 5, parentIds: [], links: [], externalActivityId: null,
  appUsage: { apps: [], groupAsFocus: false, focusGroupName: '' }, trackingMode: 'manual',
  completionLogic: { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, partialCreditThreshold: 80, streakOnMiss: 'reset' },
  cadenceConfig: { type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7 }, crossFeatureLink: null,
};

function goalToCriteria(g: Goal): CriteriaForm {
  return {
    id: g.id, title: g.title, description: g.description || '', category: g.category, period: g.period,
    targetType: g.target.type,
    targetHours: g.target.targetSeconds ? Math.floor(g.target.targetSeconds / 3600) : 0,
    targetMinutes: g.target.targetSeconds ? Math.floor((g.target.targetSeconds % 3600) / 60) : 30,
    externalHours: g.target.maxExternalSeconds ? Math.floor(g.target.maxExternalSeconds / 3600) : 0,
    externalMinutes: g.target.maxExternalSeconds ? Math.floor((g.target.maxExternalSeconds % 3600) / 60) : 30,
    matchCategory: g.target.matchCategory || '', detectionEnabled: g.detection?.enabled || false,
    detectionMode: g.detection?.mode || 'positive', detectionKeywords: g.detection?.keywords?.join(', ') || '',
    detectionMinMinutes: g.detection?.minMinutes || 5, parentIds: g.parentIds?.length ? g.parentIds : (g.parentId ? [g.parentId] : []),
    links: g.links || [], externalActivityId: g.externalActivityId ?? null,
    appUsage: { apps: (g.target?.matchApps ?? []).filter(Boolean), groupAsFocus: false, focusGroupName: '' },
    trackingMode: g.trackingMode || 'manual',
    completionLogic: g.completionLogic || { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, streakOnMiss: 'reset' },
    cadenceConfig: g.cadenceConfig || { type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7 },
    crossFeatureLink: g.crossFeatureLink ?? null,
  };
}

export function criteriaToGoal(c: CriteriaForm, date: string, existingId?: string): Goal {
  return {
    id: existingId || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: c.title.trim(), description: c.description.trim() || undefined, category: c.category,
    target: { type: c.targetType, targetSeconds: c.targetType === 'time' ? c.targetHours * 3600 + c.targetMinutes * 60 : undefined, maxExternalSeconds: c.targetType === 'external' ? c.externalHours * 3600 + c.externalMinutes * 60 : undefined, matchCategory: c.matchCategory || undefined, matchApps: c.targetType === 'app' ? c.appUsage?.apps ?? [] : undefined },
    period: c.period, status: 'active', date, source: 'manual', links: c.links, progressSeconds: 0, createdAt: new Date().toISOString(),
    parentId: c.parentIds[0] || undefined, parentIds: c.parentIds.length ? c.parentIds : undefined,
    detection: c.detectionEnabled ? { enabled: true, mode: c.detectionMode, keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean), minMinutes: c.detectionMinMinutes } : undefined,
    externalActivityId: c.externalActivityId ?? null, trackingMode: c.trackingMode, completionLogic: c.completionLogic, cadenceConfig: c.cadenceConfig, crossFeatureLink: c.crossFeatureLink ?? null,
  };
}

/* ═══════════════════ UI pieces ═══════════════════ */

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] px-3 py-2.5 flex items-center gap-2">
      <span className={accent}>{icon}</span>
      <div className="min-w-0"><div className="text-[14px] font-semibold text-zinc-100 tabular-nums">{value}</div><div className="text-[10px] text-zinc-600">{label}</div></div>
    </div>
  );
}

/* — DeadlineRadar: mini month calendar + countdown list — */
function DeadlineRadar({ marks, selectedDate, onPick }: { marks: Map<string, { color: string; label: string }[]>; selectedDate: string; onPick: (d: string) => void }) {
  const [viewMonth, setViewMonth] = useState(selectedDate.slice(0, 7));
  useEffect(() => setViewMonth(selectedDate.slice(0, 7)), [selectedDate]);
  const { lead, dim, y, m } = useMemo(() => { const [yy, mm] = viewMonth.split('-').map(Number); const first = new Date(yy, mm - 1, 1); return { lead: (first.getDay() + 6) % 7, dim: new Date(yy, mm, 0).getDate(), y: yy, m: mm }; }, [viewMonth]);
  const shiftMonth = (n: number) => { const d = new Date(y, m - 1 + n, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const upcoming = useMemo(() => { const all: { date: string; mark: { color: string; label: string } }[] = []; marks.forEach((list, date) => list.forEach(mark => all.push({ date, mark }))); return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5); }, [marks]);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = todayStr();

  return (
    <WarmCard ambient>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-medium text-zinc-400 flex items-center gap-1.5"><CalendarDays size={13} className="text-amber-400" />Deadline Radar</div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronLeft size={13} /></button>
          <span className="text-[10px] text-zinc-500 w-[76px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronRight size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-[8px] text-zinc-600 py-0.5">{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: dim }).map((_, i) => {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const dayMarks = marks.get(dateStr) || []; const isToday = dateStr === today;
          return (
            <button key={dateStr} onClick={() => onPick(dateStr)} className={`relative h-7 rounded-md text-[10px] tabular-nums transition-colors flex flex-col items-center justify-center ${isToday ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}>
              {i + 1}
              {dayMarks.length > 0 && <span className="flex gap-0.5 absolute bottom-0.5">{dayMarks.slice(0, 3).map((mk, j) => <span key={j} className="w-1 h-1 rounded-full" style={{ background: mk.color }} />)}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-zinc-800/50 pt-2">
        {upcoming.length === 0 ? <p className="text-[11px] text-zinc-600 text-center py-1">Nothing on the horizon</p> :
          upcoming.map(({ date, mark }, i) => { const du = daysUntil(date); const isNull = du === null; const overdue = !isNull && du < 0;
            return (
              <button key={i} onClick={() => onPick(date)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mark.color }} />
                <span className="flex-1 text-[11px] text-zinc-400 truncate">{mark.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 tabular-nums ${overdue ? 'text-red-400 border-red-500/30 bg-red-500/10' : !isNull && du <= 3 ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-zinc-500 border-zinc-700/50'}`}>
                  {isNull ? '—' : overdue ? `${-du}d overdue` : du === 0 ? 'today' : `in ${du}d`}
                </span>
              </button>
            );
          })
        }
      </div>
    </WarmCard>
  );
}

/* — BellBoard: reminders as tickets with amber time-rail — */
function BellBoard({ reminders, onCreate, onToggle, onDelete, selectedDate }: {
  reminders: Reminder[]; onCreate: (text: string, dueDate?: string) => void; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; selectedDate?: string;
}) {
  const [text, setText] = useState(''); const [dueDate, setDueDate] = useState(selectedDate || '');
  const add = () => { if (text.trim()) { onCreate(text.trim(), dueDate || undefined); setText(''); setDueDate(selectedDate || ''); } };
  const formatDisplayDate = (d: string) => {
    if (!d) return ''; const date = new Date(d + 'T00:00:00'); const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday'; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const quickDates = useMemo(() => { const today = todayStr(); const tomorrow = addDaysStr(today, 1); const nextWeek = addDaysStr(today, 7); return [{ label: 'Today', value: today }, { label: 'Tomorrow', value: tomorrow }, { label: 'Next week', value: nextWeek }]; }, []);

  return (
    <WarmCard ambient>
      <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
        <Bell size={13} className="text-amber-400" />Events & Reminders
        {reminders.filter(r => !r.done).length > 0 && <span className="ml-auto text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{reminders.filter(r => !r.done).length} active</span>}
      </div>
      <div className="space-y-2 mb-3">
        <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="What's happening? (event, reminder, task…)" className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20 transition-colors" />
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-1.5">
            <Calendar size={12} className="text-amber-400/70 shrink-0" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none [&::-webkit-calendar-picker-indicator]:opacity-50" />
            {dueDate && <button onClick={() => setDueDate('')} className="text-zinc-600 hover:text-zinc-400"><X size={11} /></button>}
          </div>
          <span className="text-[11px] text-zinc-500 shrink-0">{dueDate ? formatDisplayDate(dueDate) : 'Pick a date'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {quickDates.map(qd => (
            <button key={qd.value} onClick={() => setDueDate(dueDate === qd.value ? '' : qd.value)}
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${dueDate === qd.value ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' : 'bg-zinc-900/40 text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/50'}`}>
              {qd.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={add} disabled={!text.trim()} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/25 hover:bg-pink-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[12px] font-medium">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>
      {reminders.length === 0 ? (
        <div className="text-center py-4"><Bell size={20} className="mx-auto text-zinc-700 mb-2" /><p className="text-[11px] text-zinc-600">No reminders yet</p><p className="text-[10px] text-zinc-700 mt-0.5">Add one above to get started</p></div>
      ) : (
        <div className="space-y-1.5">
          {reminders.map(r => {
            const isOverdue = r.due_date && daysUntil(r.due_date) < 0 && !r.done; const isToday = r.due_date && daysUntil(r.due_date) === 0 && !r.done;
            return (
              <div key={r.id} className={`group flex items-center gap-2 pl-2.5 pr-1.5 py-2 rounded-lg border-l-2 transition-colors ${r.done ? 'bg-zinc-900/20 border-l-zinc-800' : isOverdue ? 'bg-rose-500/5 border-l-rose-500/50' : isToday ? 'bg-pink-500/5 border-l-pink-500/50' : 'bg-zinc-900/30 border-l-pink-500/30 hover:bg-zinc-800/30'}`}>
                <button onClick={() => onToggle(r.id, !r.done)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${r.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-pink-400/60'}`}>
                  {r.done && <CheckCircle2 size={10} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] block truncate ${r.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{r.text}</span>
                  {r.due_date && <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-rose-400' : isToday ? 'text-pink-400' : 'text-zinc-500'}`}><Calendar size={9} />{formatDisplayDate(r.due_date)}{isOverdue && <span className="text-[9px] text-rose-400/70">(overdue)</span>}</span>}
                </div>
                <button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-all"><Trash2 size={11} /></button>
              </div>
            );
          })}
        </div>
      )}
    </WarmCard>
  );
}

/* ── loadCompletions helper ── */
function loadCompletions(): any[] {
  try { return (window as any).deskflowAPI?.getCompletions?.() || []; } catch { return []; }
}

/* ── calendar side toggle ── */
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

/* ═══════════════════ main component ═══════════════════ */

interface SchedulePageProps { embedded?: boolean; }

export function SchedulePage({ embedded }: SchedulePageProps) {
  const api = (window as any).deskflowAPI;
  const [side, toggleSide] = useCalendarSide();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; createdAt: string; goalId?: string; scheduleId?: string; deadlineId?: string; parentTodoId?: string; dueDate?: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);

  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* ── load ── */
  const loadGoals = useCallback(async (_date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.getGoalsBatch('2000-01-01', addDaysStr(todayStr(), 120));
      const map = new Map<string, any>();
      for (const d of (res.days || []) as any[]) { for (const g of (d.goals || []) as any[]) { if (!g.id) continue; map.set(g.id, g); } }
      setGoals([...map.values()]);
    } catch (e: any) { setError(e?.message || 'Failed to load goals'); } finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    loadGoals(selectedDate);
    (async () => { try { const res = await api.getSchedule(); setSchedule(res.entries || []); } catch {} })();
    (async () => { try { const res = await api.getDeadlines({ days: 60 }); setDeadlines(res.deadlines || []); } catch {} })();
    (async () => { try { const res = await api.getReminders(); setReminders(res.reminders || []); } catch {} })();
    (async () => { try { const res = await api.todoList?.(); if (res?.success) setTodos(res.todos || []); } catch {} })();
    (async () => { try { const res = await api.getLongtermGoals(); setLongTermGoals(res.goals || []); } catch {} })();
  }, [selectedDate, loadGoals, api]);

  /* ── schedule CRUD ── */
  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>) => {
    try { const res = await api.addScheduleEntry(entry); if (res?.success && res.id) setSchedule(prev => [...prev, { ...entry, id: res.id, createdAt: new Date().toISOString() }]); } catch {}
  };
  const updateScheduleEntry = async (id: string, patch: Partial<ScheduleEntry>) => { setSchedule(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e))); try { await api.updateScheduleEntry(id, patch); } catch {} };
  const deleteScheduleEntry = async (id: string) => { setSchedule(prev => prev.filter(e => e.id !== id)); try { await api.deleteScheduleEntry(id); } catch {} };

  /* ── deadlines ── */
  const handleAddDeadline = async (dl: Omit<Deadline, 'id' | 'createdAt' | 'status'>) => {
    try { const res = await api.addDeadline?.(dl); if (res?.success && res.id) setDeadlines(prev => [...prev, { ...dl, id: res.id, createdAt: res.createdAt || new Date().toISOString(), status: 'pending' }]); } catch {}
  };
  const handleDeleteDeadline = async (id: string) => { setDeadlines(prev => prev.filter(d => d.id !== id)); try { await api.deleteDeadline?.(id); } catch {} };
  const handleUpdateDeadline = async (id: string, patch: Partial<Deadline>) => { setDeadlines(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d))); try { await api.updateDeadline?.(id, patch); } catch {} };
  const handleCompleteDeadline = async (id: string) => { setDeadlines(prev => prev.map(d => (d.id === id ? { ...d, status: 'completed' } : d))); try { await api.completeDeadline?.(id); } catch {} };

  /* ── reminders ── */
  const handleToggleReminder = async (id: string, done: boolean) => { setReminders(prev => prev.map(r => (r.id === id ? { ...r, done } : r))); try { await api.toggleReminder?.(id, done); } catch {} };
  const handleDeleteReminder = async (id: string) => { setReminders(prev => prev.filter(r => r.id !== id)); try { await api.deleteReminder?.(id); } catch {} };

  /* ── derived ── */
  const weekDates = useMemo(() => { const mon = mondayOf(selectedDate); return Array.from({ length: 7 }, (_, i) => addDaysStr(mon, i)); }, [selectedDate]);
  const todaySchedule = useMemo(() => schedule.filter(e => e && e.day_of_week != null), [schedule]);
  const doneCount = goals.filter(g => g.status === 'done').length;
  const tracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const bestStreak = goals.reduce((mx, g) => Math.max(mx, g.streak || 0), 0);

  const goalOptions = useMemo(() => goals.map(g => ({ id: g.id, title: g.title, category: g.category })), [goals]);
  const deadlineOptions = useMemo(() => deadlines.map(d => ({ id: d.id, title: d.title, dueDate: d.due_date })), [deadlines]);
  const scheduleOptions = useMemo(() => schedule.map(e => ({ id: e.id, title: e.title, startTime: e.start_time, endTime: e.end_time })), [schedule]);

  const radarMarks = useMemo(() => {
    const m = new Map<string, { color: string; label: string }[]>();
    const push = (date: string, mark: { color: string; label: string }) => { if (!m.has(date)) m.set(date, []); m.get(date)!.push(mark); };
    deadlines.forEach(d => { if (d.due_date && d.status !== 'completed') push(d.due_date, { color: '#f43f5e', label: d.title }); });
    reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: '#fbbf24', label: r.text }); });
    longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: '#a78bfa', label: l.title }); });
    todos.forEach(t => { if (t.dueDate && !t.done) push(t.dueDate, { color: '#a1a1aa', label: t.text }); });
    return m;
  }, [deadlines, reminders, longTermGoals, todos]);

  /* ── render ── */
  return (
    <div className="w-full max-w-[1600px] mx-auto" style={{ background: '#09090b' }}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="warmth-serif text-[22px] text-zinc-200 leading-tight">Schedule</h1>
          <p className="text-[12px] text-zinc-500 mt-0.5">{prettyDate(selectedDate)} · manage blocks, deadlines & reminders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all duration-200 text-[12px] font-medium" style={{ transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
            <Plus size={13} /> Add Block
          </button>
          <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 hover:border-pink-500/30 hover:text-pink-400 transition-all duration-200 text-[12px] font-medium" style={{ transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
            <Bell size={13} /> Add Deadline
          </button>
        </div>
      </div>

      {/* Calendar Strip */}
      <CalendarStrip selectedDate={selectedDate} onDateChange={setSelectedDate} goalDates={new Set(Object.keys(weekDates))} marks={radarMarks} weekGoals={{}} />

      {/* Focus indicator */}
      <AnimatePresence>
        {focusState?.isActive && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-[11px] text-pink-300 mb-4">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-pink-400" /></span>
            {focusState.isBroken ? 'Focus session broken — progress paused' : `Focus session live — tracking ${activeGoalIds.length} goal${activeGoalIds.length !== 1 ? 's' : ''}`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Two-column layout ═══ */}
      <div className={`flex flex-col lg:flex-row gap-4 ${side === 'left' ? 'lg:flex-row-reverse' : ''}`}>

        {/* LEFT (2/3): ScheduleCard week view + TodoList + ScheduleSyncCard */}
        <div className="lg:flex-2 min-w-0 space-y-4">

          {/* ScheduleCard — Week View */}
          <WarmCard ambient>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-zinc-300">{showWeekSchedule ? "Week's Schedule" : `${DAY_SHORT[new Date(selectedDate + 'T00:00:00').getDay()]}'s Schedule`}</span>
              <button onClick={() => setShowWeekSchedule(v => !v)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${showWeekSchedule ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' : 'bg-zinc-900/60 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'}`} style={{ transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                {showWeekSchedule ? 'Whole week' : 'Today only'}
              </button>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-zinc-800/40 rounded-lg animate-pulse" />)}</div>
            ) : error ? (
              <div className="text-center py-4 text-[11px] text-red-400">{error}</div>
            ) : todaySchedule.length === 0 ? (
              <div className="text-center py-6"><Calendar size={24} className="mx-auto text-zinc-700 mb-2" /><p className="text-[11px] text-zinc-600">No schedule blocks for this day</p><p className="text-[10px] text-zinc-700 mt-0.5">Tap "Add Block" to create one</p></div>
            ) : (
              <ScheduleCard entries={todaySchedule} selectedDate={selectedDate} selectedDay={new Date(selectedDate + 'T00:00:00').getDay()} onAdd={addScheduleEntry} onUpdate={updateScheduleEntry} onDelete={deleteScheduleEntry} linkedGoals={goalOptions} showAll={showWeekSchedule} />
            )}
          </WarmCard>

          {/* TodoList */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5"><CheckCircle2 size={13} className="text-pink-400" />Tasks <span className="ml-auto text-[10px] text-zinc-600">{todos.filter(t => !t.done).length} remaining</span></div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-zinc-800/40 rounded-lg animate-pulse" />)}</div>
            ) : error ? (
              <div className="text-center py-4 text-[11px] text-red-400">{error}</div>
            ) : todos.length === 0 ? (
              <div className="text-center py-4"><CheckCircle2 size={20} className="mx-auto text-zinc-700 mb-2" /><p className="text-[11px] text-zinc-600">No tasks yet</p><p className="text-[10px] text-zinc-700 mt-0.5">Create one above to get started</p></div>
            ) : (
              <TodoList goalOptions={goalOptions} deadlineOptions={deadlineOptions} scheduleOptions={scheduleOptions} />
            )}
          </WarmCard>

          {/* ScheduleSyncCard */}
          <ScheduleSyncCard schedule={schedule} goals={goals} loading={loading} />
        </div>

        {/* RIGHT (1/3): DeadlineRadar + BellBoard + DeadlinesCard */}
        <div className="lg:flex-1 min-w-0 space-y-4">

          {/* DeadlineRadar */}
          <div className={loading ? 'animate-pulse' : ''}>
            <DeadlineRadar marks={radarMarks} selectedDate={selectedDate} onPick={setSelectedDate} />
          </div>

          {/* BellBoard */}
          <BellBoard reminders={reminders} onCreate={(text, dueDate) => { try { api.createReminder?.({ text, dueDate: dueDate || selectedDate }); } catch {} setReminders(prev => [...prev, { id: `rem_${Date.now()}`, text, due_date: dueDate || selectedDate, goal_id: null, done: false, created_at: new Date().toISOString() }]); }} onToggle={handleToggleReminder} onDelete={handleDeleteReminder} selectedDate={selectedDate} />

          {/* DeadlinesCard */}
          <DeadlinesCard deadlines={deadlines} reminders={reminders} loading={loading} error={error} onAdd={handleAddDeadline} onDelete={handleDeleteDeadline} onUpdate={handleUpdateDeadline} onComplete={handleCompleteDeadline} onToggleReminder={handleToggleReminder} onDeleteReminder={handleDeleteReminder} goalOptions={goalOptions} />
        </div>

        {/* Calendar sidebar */}
        <div className="lg:w-72 shrink-0">
          <WarmCard ambient>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] font-medium text-zinc-400 flex items-center gap-1.5"><CalendarDays size={13} className="text-amber-400" />{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
              <button onClick={toggleSide} className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 transition-colors">{side === 'left' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}</button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center mb-3">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => <div key={d} className="text-[8px] text-zinc-600 py-0.5">{d}</div>)}</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {deadlines.filter(d => d.due_date && d.status !== 'completed').slice(0, 5).map(d => (
                <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-[11px]"><span className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500" /><span className="flex-1 text-zinc-400 truncate">{d.title}</span><span className="text-[9px] text-zinc-600 tabular-nums">{daysUntil(d.due_date) ?? '—'}d</span></div>
              ))}
              {reminders.filter(r => !r.done).slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-[11px]"><span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" /><span className="flex-1 text-zinc-400 truncate">{r.text}</span></div>
              ))}
              {schedule.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-[11px]"><span className="w-1.5 h-1.5 rounded-full shrink-0 bg-pink-500" /><span className="flex-1 text-zinc-400 truncate">{s.title}</span><span className="text-[9px] text-zinc-600 tabular-nums">{s.start_time}</span></div>
              ))}
              {longTermGoals.slice(0, 3).map(l => (
                <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-[11px]"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: catDot(l.category || 'work') }} /><span className="flex-1 text-zinc-400 truncate">{l.title}</span></div>
              ))}
            </div>
          </WarmCard>
        </div>
      </div>
    </div>
  );
}
