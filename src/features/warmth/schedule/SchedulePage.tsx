// src/features/warmth/schedule/SchedulePage.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CalendarDays, Calendar, Clock, Target, Flame, X, Loader2, RefreshCw,
} from 'lucide-react';
import { WarmCard } from '../WarmCard';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { ScheduleCard } from '../../../pages/dashboard/ScheduleCard';
import { CalendarSidebar } from '../../../components/goals/CalendarSidebar';
import { TodoList } from '../../../components/goals/TodoList';
import { ScheduleSyncCard } from '../../../components/dashboard/ScheduleSyncCard';
import { DeadlinesCard } from '../../../components/dashboard/DeadlinesCard';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import type { Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry, ScheduleCategory } from '../../../components/dashboard/types';

/* ── daily reflection (hard stats) ── */
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
/* "14:30" -> "2:30 PM". Returns '' for anything that is not a valid HH:mm so a
   malformed DB value degrades to nothing rather than rendering "NaN:NaN". */
function formatTimeOfDay(hhmm: string): string {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || '').trim());
  if (!m) return '';
  const h = Number(m[1]); const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
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
  const { lead, dim, year, month } = useMemo(() => { const [yy, mm] = viewMonth.split('-').map(Number); const first = new Date(yy, mm - 1, 1); return { lead: (first.getDay() + 6) % 7, dim: new Date(yy, mm, 0).getDate(), year: yy, month: mm }; }, [viewMonth]);
  const shiftMonth = (n: number) => { const d = new Date(year, month - 1 + n, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const upcoming = useMemo(() => { const all: { date: string; mark: { color: string; label: string } }[] = []; marks.forEach((list, date) => list.forEach(mark => all.push({ date, mark }))); return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5); }, [marks]);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
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
/* — MonthGrid: a real month calendar the user clicks to set a date.
   Reuses the DeadlineRadar grid math so both calendars behave identically. — */
function MonthGrid({ value, onPick, onClose }: { value: string; onPick: (d: string) => void; onClose: () => void }) {
  const today = todayStr();
  const [viewMonth, setViewMonth] = useState(value || today);
  useEffect(() => { if (value) setViewMonth(value); }, [value]);

  const { lead, dim, year, month } = useMemo(() => {
    const [yy, mm] = (viewMonth || today).slice(0, 7).split('-').map(Number);
    const safeY = yy || new Date().getFullYear();
    const safeM = mm || new Date().getMonth() + 1;
    const first = new Date(safeY, safeM - 1, 1);
    return { lead: (first.getDay() + 6) % 7, dim: new Date(safeY, safeM, 0).getDate(), year: safeY, month: safeM };
  }, [viewMonth, today]);

  const shiftMonth = (n: number) => { const d = new Date(year, month - 1 + n, 1); setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div
      role="dialog"
      aria-label="Choose a date"
      className="absolute z-30 mt-1.5 left-0 w-[248px] rounded-xl border border-zinc-700/60 bg-zinc-900 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
          <ChevronLeft size={14} aria-hidden />
        </button>
        <span className="text-[12px] font-medium text-foreground">{monthLabel}</span>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-[9px] text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: dim }).map((_, i) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === value;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onPick(dateStr)}
              aria-pressed={isSelected}
              aria-label={new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              className="relative h-7 rounded-md text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50"
              style={isSelected
                ? { backgroundColor: 'var(--page-accent)', color: 'var(--color-background)', fontWeight: 600 }
                : isToday
                  ? { backgroundColor: 'color-mix(in srgb, var(--page-accent) 18%, transparent)', color: 'var(--page-accent)', fontWeight: 600 }
                  : { color: 'var(--color-muted-foreground)' }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-muted)'; }}
              onMouseLeave={e => { if (!isSelected && !isToday) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
        <button type="button" onClick={() => onPick(today)}
          className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
          Today
        </button>
        <button type="button" onClick={onClose} aria-label="Close calendar"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
          <X size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function BellBoard({ reminders, onCreate, onToggle, onDelete, selectedDate }: {
  reminders: Reminder[]; onCreate: (text: string, dueDate?: string, dueTime?: string) => boolean | Promise<boolean>; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; selectedDate?: string;
}) {
  const [text, setText] = useState(''); const [dueDate, setDueDate] = useState(selectedDate || '');
  const [dueTime, setDueTime] = useState('');
  const [adding, setAdding] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  /* Only clear the input once the write actually succeeded — wiping it on a
     failed save destroys the user's typing (P5: never wipe input on error). */
  const add = async () => {
    const value = text.trim();
    if (!value || adding) return;
    setAdding(true);
    try {
      const ok = await onCreate(value, dueDate || undefined, dueTime || undefined);
      if (ok !== false) { setText(''); setDueDate(selectedDate || ''); setDueTime(''); }
    } finally { setAdding(false); }
  };
  const formatDisplayDate = (d: string) => {
    if (!d) return ''; const date = new Date(d + 'T00:00:00'); const today = new Date(); today.setHours(0, 0, 0, 0); const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday'; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const quickDates = useMemo(() => { const today = todayStr(); const tomorrow = addDaysStr(today, 1); const nextWeek = addDaysStr(today, 7); return [{ label: 'Today', value: today }, { label: 'Tomorrow', value: tomorrow }, { label: 'Next week', value: nextWeek }]; }, []);

  // Close the inline calendar on outside click / Escape (P6: forgiveness).
  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => { if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [calOpen]);

  return (
    <WarmCard ambient>
      <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
        <Bell size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />Events & Reminders
        {reminders.filter(r => !r.done).length > 0 && <span className="ml-auto text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{reminders.filter(r => !r.done).length} active</span>}
      </div>
      <div className="space-y-2 mb-3">
        <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="What's happening? (event, reminder, task…)" className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 transition-colors" />

        {/* ── date + time pickers ──
            The date cell is a BUTTON that reveals a real month grid, so picking a
            date is a direct manipulation instead of typing into a native picker.
            It is styled as an unmistakably interactive control (dashed hairline +
            signal-hue tint + hover lift) so the affordance is legible. */}
        <div className="flex items-center gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            {/* DATE — click to open the month grid */}
            <div className="relative" ref={calRef}>
              <button
                type="button"
                onClick={() => setCalOpen(v => !v)}
                aria-expanded={calOpen}
                aria-haspopup="dialog"
                aria-label={dueDate ? `Due ${formatDisplayDate(dueDate)}. Change date` : 'Pick a due date'}
                className="w-full flex items-center gap-2 bg-zinc-900/60 border border-dashed border-zinc-600/70 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:border-[var(--page-accent)]/70 hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50"
                style={dueDate ? {
                  borderStyle: 'solid',
                  borderColor: 'color-mix(in srgb, var(--page-accent) 40%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--page-accent) 8%, transparent)',
                } : undefined}
              >
                <Calendar size={12} className="shrink-0" style={{ color: 'var(--page-accent)' }} aria-hidden />
                <span className={`flex-1 text-[12px] truncate ${dueDate ? 'text-zinc-200' : 'text-zinc-500'}`}>
                  {dueDate ? formatDisplayDate(dueDate) : 'Pick a date'}
                </span>
                {dueDate && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Clear date"
                    onClick={e => { e.stopPropagation(); setDueDate(''); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setDueDate(''); } }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  >
                    <X size={11} aria-hidden />
                  </span>
                )}
              </button>

              {calOpen && (
                <MonthGrid
                  value={dueDate}
                  onPick={d => { setDueDate(d); setCalOpen(false); }}
                  onClose={() => setCalOpen(false)}
                />
              )}
            </div>

            {/* TIME — HH:mm, native picker is the right control for a time field */}
            <label className="flex items-center gap-2 bg-zinc-900/60 border border-dashed border-zinc-600/70 rounded-lg px-2.5 py-1.5 transition-colors hover:border-[var(--page-accent)]/70 hover:bg-zinc-900/90 focus-within:ring-2 focus-within:ring-[var(--page-accent)]/50"
              style={dueTime ? {
                borderStyle: 'solid',
                borderColor: 'color-mix(in srgb, var(--page-accent) 40%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--page-accent) 8%, transparent)',
              } : undefined}>
              <Clock size={12} className="shrink-0" style={{ color: 'var(--page-accent)' }} aria-hidden />
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                aria-label="Due time (optional)"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-200 outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
              />
              {dueTime && (
                <button type="button" onClick={() => setDueTime('')} aria-label="Clear time" className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                  <X size={11} aria-hidden />
                </button>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {quickDates.map(qd => (
            <button key={qd.value} onClick={() => setDueDate(dueDate === qd.value ? '' : qd.value)}
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${dueDate === qd.value ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' : 'bg-zinc-900/40 text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/50'}`}>
              {qd.label}
            </button>
          ))}
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={add}
            disabled={!text.trim() || adding}
            className="gap-1.5"
            style={{
              color: 'var(--page-accent)',
              backgroundColor: 'color-mix(in srgb, var(--page-accent) 15%, transparent)',
              borderColor: 'color-mix(in srgb, var(--page-accent) 25%, transparent)',
            }}
          >
            {adding ? <Spinner /> : <Plus size={12} aria-hidden />}
            {adding ? 'Adding…' : 'Add reminder'}
          </Button>
        </div>
      </div>
      {reminders.length === 0 ? (
        <div className="text-center py-4"><Bell size={20} className="mx-auto text-zinc-700 mb-2" /><p className="text-[11px] text-zinc-600">No reminders yet</p><p className="text-[10px] text-zinc-700 mt-0.5">Add one above to get started</p></div>
      ) : (
        <div className="space-y-1.5">
          {reminders.map(r => {
            const daysLeft = r.due_date ? daysUntil(r.due_date) : null;
            const isOverdue = daysLeft !== null && daysLeft < 0 && !r.done;
            const isToday = daysLeft !== null && daysLeft === 0 && !r.done;
            return (
              <div key={r.id} className={`group flex items-center gap-2 pl-2.5 pr-1.5 py-2 rounded-lg border-l-2 transition-colors ${r.done ? 'bg-zinc-900/20 border-l-zinc-800' : isOverdue ? 'bg-rose-500/5 border-l-rose-500/50' : isToday ? 'bg-pink-500/5 border-l-pink-500/50' : 'bg-zinc-900/30 border-l-pink-500/30 hover:bg-zinc-800/30'}`}>
                <button onClick={() => onToggle(r.id, !r.done)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${r.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-pink-400/60'}`}>
                  {r.done && <CheckCircle2 size={10} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] block truncate ${r.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{r.text}</span>
                  {r.due_date && (
                    <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-rose-400' : isToday ? 'text-pink-400' : 'text-zinc-500'}`}>
                      <Calendar size={9} aria-hidden />
                      {formatDisplayDate(r.due_date)}
                      {/* Time-of-day is only shown when the reminder actually has one. */}
                      {r.due_time && (
                        <>
                          <span className="opacity-40" aria-hidden>·</span>
                          <Clock size={9} aria-hidden />
                          <span className="tabular-nums">{formatTimeOfDay(r.due_time)}</span>
                        </>
                      )}
                      {isOverdue && <span className="text-[9px] text-rose-400/70">(overdue)</span>}
                    </span>
                  )}
                </div>
                <button onClick={() => onDelete(r.id)} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-[var(--error)] transition-opacity"><Trash2 size={11} /></button>
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

/* ── shared form affordances (Human-Centric UX #5 + Impeccable Interaction) ── */

function Spinner() {
  return <Loader2 size={13} className="animate-spin" aria-hidden />;
}

/** Inline validation message. `role="alert"` so it is announced on appearance —
 *  errors must not be conveyed by colour alone (WCAG / UX anti-pattern). */
function FormError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-3 text-[12px]" style={{ color: 'var(--error)' }}>
      {children}
    </p>
  );
}

/** Error state per P5: plain cause + a recovery action. Never a bare string. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-[12px]" style={{ color: 'var(--error)' }}>{message}</p>
      <p className="text-[11px] text-muted-foreground">RHEO could not load this section.</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
        <RefreshCw size={12} aria-hidden />
        Retry
      </Button>
    </div>
  );
}

export function SchedulePage({ embedded }: SchedulePageProps) {
  const api = (window as any).deskflowAPI;
  const reduced = useReducedMotion();
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
  const [showAddBlock, setShowAddBlock] = useState(false);
  const emptyBlockForm = () => ({
    title: '', location: '',
    day: new Date(selectedDate + 'T00:00:00').getDay().toString(),
    start_time: '09:00', end_time: '10:00',
    category: 'class' as ScheduleCategory,
  });
  const [blockForm, setBlockForm] = useState(emptyBlockForm);
  const [showAddDeadline, setShowAddDeadline] = useState(false);
  const [deadlineForm, setDeadlineForm] = useState({ title: '', due_date: todayStr(), priority: 'medium' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* Bumping this re-runs the load effect — it is the recovery action for the
     error state, so it MUST be declared before the effect that depends on it. */
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadAll = useCallback(() => setReloadNonce(n => n + 1), []);

  const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
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
    // Fetch week goals for CalendarStrip
    (async () => { try { const mon = mondayOf(selectedDate); const res = await api.getGoalsBatch(mon, addDaysStr(mon, 6)); setWeekGoals(res.days || {}); } catch { /* non-critical */ } })();
  }, [selectedDate, loadGoals, api, reloadNonce]);

  /* ── schedule CRUD ── */
  /* Returns a boolean so the caller (ScheduleCard's inline form) can keep its
     form open and surface the failure instead of closing optimistically. */
  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const res = await api.addScheduleEntry(entry);
      if (res?.success && res.id) {
        setSchedule(prev => [...prev, { ...entry, id: res.id, createdAt: new Date().toISOString() }]);
        return true;
      }
      setFormError(res?.error
        ? `RHEO could not save this block because ${res.error}. Try again.`
        : 'RHEO could not save this block. Try again.');
      return false;
    } catch {
      setFormError('RHEO could not reach the schedule store. Check the app is running, then try again.');
      return false;
    }
  };
  const updateScheduleEntry = async (id: string, patch: Partial<ScheduleEntry>) => { setSchedule(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e))); try { await api.updateScheduleEntry(id, patch); } catch {} };
  const deleteScheduleEntry = async (id: string) => { setSchedule(prev => prev.filter(e => e.id !== id)); try { await api.deleteScheduleEntry(id); } catch {} };

  const openAddBlock = () => {
    setFormError(null);
    setBlockForm(emptyBlockForm());
    setShowAddDeadline(false);
    setShowAddBlock(v => !v);
  };

  const closeForms = () => {
    setShowAddBlock(false);
    setShowAddDeadline(false);
    setFormError(null);
  };

  /* Enter submits, Escape cancels — nothing here is mouse-only (Gate D). */
  const onFormKeyDown = (submit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); closeForms(); }
  };

  const handleAddBlock = async () => {
    const title = blockForm.title.trim();
    if (!title) { setFormError('This block has no title. Type one so you recognise it on the calendar.'); return; }
    if (blockForm.end_time <= blockForm.start_time) { setFormError('This block ends before it starts. Check the start and end times.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const day = parseInt(blockForm.day, 10);
      const ok = await addScheduleEntry({
        title,
        location: blockForm.location.trim() || undefined,
        day_of_week: Number.isNaN(day) ? new Date(selectedDate + 'T00:00:00').getDay() : day,
        start_time: blockForm.start_time,
        end_time: blockForm.end_time,
        category: blockForm.category,
      });
      if (ok) { setShowAddBlock(false); setBlockForm(emptyBlockForm()); }
    } finally { setSaving(false); }
  };

  const openAddDeadline = () => {
    setFormError(null);
    setDeadlineForm({ title: '', due_date: selectedDate, priority: 'medium' });
    setShowAddBlock(false);
    setShowAddDeadline(v => !v);
  };

  const handleAddDeadlineSubmit = async () => {
    const title = deadlineForm.title.trim();
    if (!title) { setFormError('This deadline has no title. Type what is due.'); return; }
    if (!deadlineForm.due_date) { setFormError('This deadline has no due date. Pick the day it is due.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const res = await api.addDeadline?.({ title, due_date: deadlineForm.due_date, priority: deadlineForm.priority, status: 'pending' });
      if (res?.success && res.id) {
        setDeadlines(prev => [...prev, { id: res.id, title, due_date: deadlineForm.due_date, priority: deadlineForm.priority, status: 'pending', createdAt: new Date().toISOString() } as Deadline]);
        setShowAddDeadline(false);
      } else {
        setFormError(res?.error ? `RHEO could not save this deadline because ${res.error}. Try again.` : 'RHEO could not save this deadline. Try again.');
      }
    } catch (e: any) {
      setFormError('RHEO could not reach the deadline store. Check the app is running, then try again.');
    } finally { setSaving(false); }
  };

  /* ── deadlines ── */
  const handleAddDeadline = async (dl: Omit<Deadline, 'id' | 'createdAt' | 'status'>) => {
    try { const res = await api.addDeadline?.(dl); if (res?.success && res.id) setDeadlines(prev => [...prev, { ...dl, id: res.id, createdAt: res.createdAt || new Date().toISOString(), status: 'pending' }]); } catch {}
  };
  const handleDeleteDeadline = async (id: string) => { setDeadlines(prev => prev.filter(d => d.id !== id)); try { await api.deleteDeadline?.(id); } catch {} };
  const handleUpdateDeadline = async (id: string, patch: Partial<Deadline>) => { setDeadlines(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d))); try { await api.updateDeadline?.(id, patch); } catch {} };
  /* Called `api.completeDeadline`, which does not exist in preload — the real
     channel is `updateDeadlineStatus`. The optional-call `?.()` swallowed the
     miss, so completing a deadline only ever moved local state and never
     persisted. The UI vocabulary is 'completed' (DeadlineStatus / DeadlinesCard),
     so that is the value we send and store. */
  const handleCompleteDeadline = async (id: string) => {
    const prev = deadlines.find(d => d.id === id)?.status || 'pending';
    setDeadlines(list => list.map(d => (d.id === id ? { ...d, status: 'completed' } : d)));
    try {
      const res = await api.updateDeadlineStatus?.(id, 'completed');
      if (res && res.success === false) throw new Error(res.error || 'deadline not saved');
    } catch {
      setDeadlines(list => list.map(d => (d.id === id ? { ...d, status: prev } as Deadline : d)));
      setFormError('RHEO could not mark this deadline complete. Try again.');
    }
  };

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
    <div className={embedded ? 'w-full h-full' : 'w-full max-w-[1600px] mx-auto px-4 py-6'}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[18px] text-zinc-200 font-semibold leading-tight">Schedule</h1>
          <p className="text-[12px] text-zinc-500 mt-0.5">{prettyDate(selectedDate)} · manage blocks, deadlines & reminders</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={openAddBlock}
            aria-expanded={showAddBlock}
            aria-controls="add-block-form"
            className="gap-1.5"
            style={{
              color: 'var(--page-accent)',
              backgroundColor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--page-accent) 28%, transparent)',
            }}
          >
            <Plus size={13} aria-hidden />
            {showAddBlock ? 'Cancel' : 'Add block'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openAddDeadline}
            aria-expanded={showAddDeadline}
            aria-controls="add-deadline-form"
            className="gap-1.5"
          >
            <Bell size={13} aria-hidden />
            {showAddDeadline ? 'Cancel' : 'Add deadline'}
          </Button>
        </div>
      </div>

      {/* ═══ Add Block / Add Deadline ═══
           LAMINAR: single signal hue per surface (design.md §2) → every accent
           resolves to var(--page-accent) (clay on the life page), never a
           hardcoded pink-500. Errors resolve to var(--error) only. */}
      <AnimatePresence>
        {showAddBlock && (
          <motion.div
            key="add-block"
            id="add-block-form"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4"
          >
            <WarmCard>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-100 mb-4">
                <Calendar size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />
                New schedule block
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="sm:col-span-3">
                  <Label htmlFor="blk-title">Title</Label>
                  <Input
                    id="blk-title"
                    value={blockForm.title}
                    onChange={e => { setFormError(null); setBlockForm(p => ({ ...p, title: e.target.value })); }}
                    onKeyDown={onFormKeyDown(handleAddBlock)}
                    placeholder="e.g. Linear Algebra lecture"
                    aria-required="true"
                    aria-invalid={!!formError && !blockForm.title.trim()}
                    aria-describedby="blk-err"
                    autoFocus
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label htmlFor="blk-loc">Location <span className="text-muted-foreground font-normal">optional</span></Label>
                  <Input
                    id="blk-loc"
                    value={blockForm.location}
                    onChange={e => setBlockForm(p => ({ ...p, location: e.target.value }))}
                    onKeyDown={onFormKeyDown(handleAddBlock)}
                    placeholder="Room 204"
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="blk-day">Day</Label>
                  <select
                    id="blk-day"
                    value={blockForm.day}
                    onChange={e => setBlockForm(p => ({ ...p, day: e.target.value }))}
                    className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-[var(--page-accent)] focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/30"
                  >
                    {DAY_SHORT.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="blk-start">Starts</Label>
                  <Input
                    id="blk-start"
                    type="time"
                    value={blockForm.start_time}
                    onChange={e => setBlockForm(p => ({ ...p, start_time: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="blk-end">Ends</Label>
                  <Input
                    id="blk-end"
                    type="time"
                    value={blockForm.end_time}
                    onChange={e => setBlockForm(p => ({ ...p, end_time: e.target.value }))}
                    aria-invalid={blockForm.end_time <= blockForm.start_time}
                    className="mt-1"
                  />
                </div>
              </div>

              {formError && <FormError id="blk-err">{formError}</FormError>}

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => closeForms()}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleAddBlock}
                  disabled={saving || !blockForm.title.trim()}
                  className="gap-1.5"
                >
                  {saving ? <Spinner /> : <Plus size={13} aria-hidden />}
                  {saving ? 'Saving block…' : 'Save block'}
                </Button>
              </div>
            </WarmCard>
          </motion.div>
        )}

        {showAddDeadline && (
          <motion.div
            key="add-deadline"
            id="add-deadline-form"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4"
          >
            <WarmCard>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-100 mb-4">
                <Bell size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />
                New deadline
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="sm:col-span-3">
                  <Label htmlFor="dl-title">Title</Label>
                  <Input
                    id="dl-title"
                    value={deadlineForm.title}
                    onChange={e => { setFormError(null); setDeadlineForm(p => ({ ...p, title: e.target.value })); }}
                    onKeyDown={onFormKeyDown(handleAddDeadlineSubmit)}
                    placeholder="e.g. Problem set 3"
                    aria-required="true"
                    aria-invalid={!!formError && !deadlineForm.title.trim()}
                    aria-describedby="dl-err"
                    autoFocus
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="dl-due">Due</Label>
                  <Input
                    id="dl-due"
                    type="date"
                    value={deadlineForm.due_date}
                    onChange={e => setDeadlineForm(p => ({ ...p, due_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-1">
                  <Label htmlFor="dl-pri">Priority</Label>
                  <select
                    id="dl-pri"
                    value={deadlineForm.priority}
                    onChange={e => setDeadlineForm(p => ({ ...p, priority: e.target.value }))}
                    className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-[var(--page-accent)] focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {formError && <FormError id="dl-err">{formError}</FormError>}

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => closeForms()}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleAddDeadlineSubmit}
                  disabled={saving || !deadlineForm.title.trim()}
                  className="gap-1.5"
                >
                  {saving ? <Spinner /> : <Plus size={13} aria-hidden />}
                  {saving ? 'Saving deadline…' : 'Save deadline'}
                </Button>
              </div>
            </WarmCard>
          </motion.div>
        )}
      </AnimatePresence>      

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
        <div className="flex-[2] min-w-0 space-y-4">

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
              <LoadError message={error} onRetry={reloadAll} />
            ) : (
              /* Always mount ScheduleCard — it owns the "+ Add entry" button and
                 its own form. Replacing it with a static empty <div> here (the old
                 behaviour) removed the only way to create the first block. */
              <ScheduleCard entries={todaySchedule} selectedDate={selectedDate} selectedDay={new Date(selectedDate + 'T00:00:00').getDay()} onAdd={addScheduleEntry} onUpdate={updateScheduleEntry} onDelete={deleteScheduleEntry} linkedGoals={goalOptions} showAll={showWeekSchedule} />
            )}
          </WarmCard>

          {/* TodoList */}
          <WarmCard ambient>
            <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5"><CheckCircle2 size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />Tasks</div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-zinc-800/40 rounded-lg animate-pulse" />)}</div>
            ) : error ? (
              <LoadError message={error} onRetry={reloadAll} />
            ) : (
              /* Always mount TodoList — it owns the "+ Add todo" button and its own
                 form, and reloads todos itself. Gating it on todos.length meant an
                 empty list showed "create one above" with no way to do so. */
              <TodoList goalOptions={goalOptions} deadlineOptions={deadlineOptions} scheduleOptions={scheduleOptions} />
            )}
          </WarmCard>

          {/* ScheduleSyncCard */}
          <ScheduleSyncCard schedule={schedule} goals={goals} loading={loading} />
        </div>

        {/* RIGHT (1/3): DeadlineRadar + BellBoard + DeadlinesCard */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* DeadlineRadar */}
          {loading ? (
            <WarmCard ambient>
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-zinc-800/40 rounded w-1/3" />
                <div className="grid grid-cols-7 gap-0.5">{Array.from({ length: 28 }).map((_, i) => <div key={i} className="h-7 bg-zinc-800/30 rounded" />)}</div>
                <div className="h-8 bg-zinc-800/40 rounded w-full" />
              </div>
            </WarmCard>
          ) : (
            <DeadlineRadar marks={radarMarks} selectedDate={selectedDate} onPick={setSelectedDate} />
          )}

          {/* BellBoard */}
          {loading ? (
            <WarmCard ambient>
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-zinc-800/40 rounded w-1/4" />
                <div className="h-10 bg-zinc-800/30 rounded" />
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-zinc-800/30 rounded" />)}
              </div>
            </WarmCard>
          ) : (
            <BellBoard
              reminders={reminders}
              onCreate={async (text, dueDate, dueTime) => {
                const due = dueDate || selectedDate;
                // NOTE: the IPC contract is snake_case (due_date/goal_id). The old
                // call sent `dueDate`, so the handler stored NULL and every reminder
                // lost its date on the next reload.
                try {
                  const res = await api.createReminder?.({ text, due_date: due, due_time: dueTime || undefined });
                  if (!res?.success || !res.id) { setFormError('RHEO could not save this reminder. Try again.'); return false; }
                  setFormError(null);
                  setReminders(prev => [...prev, { id: res.id, text, due_date: due, due_time: dueTime || null, goal_id: null, done: false, created_at: new Date().toISOString() } as any]);
                  return true;
                } catch {
                  setFormError('RHEO could not reach the reminder store. Try again.');
                  return false;
                }
              }}
              onToggle={handleToggleReminder}
              onDelete={handleDeleteReminder}
              selectedDate={selectedDate}
            />
          )}

          {/* DeadlinesCard */}
          <DeadlinesCard deadlines={deadlines} reminders={reminders} loading={loading} error={error} onAdd={handleAddDeadline} onDelete={handleDeleteDeadline} onUpdate={handleUpdateDeadline} onComplete={handleCompleteDeadline} onToggleReminder={handleToggleReminder} onDeleteReminder={handleDeleteReminder} goalOptions={goalOptions} />
        </div>

        {/* 3D Calendar Sidebar — flex child with proper sizing and sticky */}
        <div className="flex flex-col lg:min-w-[320px] lg:max-w-[480px] lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <CalendarSidebar
            side={side}
            onToggleSide={toggleSide}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            weekGoals={weekGoals}
            marks={radarMarks}
            goalDates={new Set(Object.keys(weekGoals))}
            goals={goals}
            deadlines={deadlines}
            reminders={reminders}
            schedule={schedule}
            longTermGoals={longTermGoals}
          />
        </div>
      </div>
    </div>
  );
}
