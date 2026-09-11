# Round 01 — CONTEXT: src/features/warmth/gold/GoldPage.tsx (FULL 1303 lines, verbatim)

> Embedded by Project Owner (opencode) on 2026-08-07 in response to Specialist REQUEST #1.
> This is the exact current file content — line count 1303.

```// src/features/warmth/gold/GoldPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Flame, Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp,
  CalendarDays, NotebookPen, TrendingUp, ChevronLeft, ChevronRight,
  Sparkles, Lightbulb, Timer, Code2, Activity, Pencil, X,
} from 'lucide-react';
import { WarmCard } from '../WarmCard';
import { CalendarStrip } from '../../../components/goals/CalendarStrip';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../../../components/goals/GoalCard';
import { CriteriaBuilder } from '../../../components/goals/CriteriaBuilder';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import { confetti } from '../../../components/ui/confetti';
import { NumberTicker } from '../../../components/ui/number-ticker';
import { BorderBeam } from '../../../components/ui/border-beam';
import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper';
import { LifeRiver } from '../../../components/life-river/river';
import type { Goal, LongTermGoal, GoalCategory } from '../../../components/dashboard/types';
import { loadCompletions } from '../../covenant/storage';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• helpers â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
function daysUntil(dateStr: string): number {
  const a = new Date(todayStr() + 'T00:00:00').getTime();
  const b = new Date(dateStr + 'T00:00:00').getTime();
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

/* â”€â”€ daily reflection (hard stats) â”€â”€ */
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

/* covenant overall streak: count consecutive days with any completion, back from today */
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

/* smart prompt generation â€” blend soft + hard into 4 max reflection prompts */
function buildPrompts(data: DailyReflection, streak: number): string[] {
  const prompts: string[] = [];
  const prod = formatTime(data.productiveSec);
  if (data.goals.completed === 0 && data.goals.total === 0 && data.productiveSec === 0 && streak === 0) {
    return ['Start with one thing â€” even small. What\'s the one goal that matters today?'];
  }
  if (data.goals.total > 0) {
    prompts.push(data.goals.completed === data.goals.total
      ? `You sealed all ${data.goals.total} goal${data.goals.total > 1 ? 's' : ''} â€” what felt most impactful?`
      : `${data.goals.completed}/${data.goals.total} goals done â€” what blocked the rest?`);
  }
  if (data.productiveSec > 0) {
    prompts.push(`You spent ${prod} in productive time today â€” where did it go?`);
  }
  if (data.habits.completed > 0 && data.habits.total > 0) {
    prompts.push(`Habits: ${data.habits.completed}/${data.habits.total} â€” which kept you honest?`);
  }
  if (streak > 0) prompts.push(`Covenant day ${streak} â€” what's the habit that holds the streak together?`);
  if (data.codingSec > 0) prompts.push(`You coded for ${formatTime(data.codingSec)} â€” something new or deep work?`);
  return prompts.slice(0, 4);
}

/* species predicate â€” this is the whole routing logic */
const isWeeklyish = (g: Goal) => !!g.isHabit || g.cadence === 'weekly' || g.period === 'weekly';

const CAT_META: Record<string, { label: string; dot: string }> = {
  work:          { label: 'Work',          dot: '#ec4899' },
  personal:      { label: 'Personal',      dot: '#8b5cf6' },
  health:        { label: 'Health',        dot: '#34d399' },
  learning:      { label: 'Learning',      dot: '#22d3ee' },
  finance:       { label: 'Finance',       dot: '#fbbf24' },
  relationships: { label: 'Relationships', dot: '#fb7185' },
};
const catDot = (c: string) => (CAT_META[c] || CAT_META.work).dot;

const defaultCriteria: CriteriaForm = {
  title: '', description: '', category: 'work', period: 'daily',
  targetType: 'completion', targetHours: 0, targetMinutes: 30, matchCategory: '',
  detectionEnabled: false, detectionMode: 'positive', detectionKeywords: '',
  detectionMinMinutes: 5, parentId: '', links: [],
};

function goalToCriteria(g: Goal): CriteriaForm {
  return {
    title: g.title, description: g.description || '', category: g.category, period: g.period,
    targetType: g.target.type,
    targetHours: g.target.targetSeconds ? Math.floor(g.target.targetSeconds / 3600) : 0,
    targetMinutes: g.target.targetSeconds ? Math.floor((g.target.targetSeconds % 3600) / 60) : 30,
    matchCategory: g.target.matchCategory || '',
    detectionEnabled: g.detection?.enabled || false,
    detectionMode: g.detection?.mode || 'positive',
    detectionKeywords: g.detection?.keywords?.join(', ') || '',
    detectionMinMinutes: g.detection?.minMinutes || 5,
    parentId: g.parentId || '', links: g.links || [],
  };
}

function criteriaToGoal(c: CriteriaForm, date: string, existingId?: string): Goal {
  return {
    id: existingId || `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: c.title.trim(),
    description: c.description.trim() || undefined,
    category: c.category,
    target: {
      type: c.targetType,
      targetSeconds: c.targetType === 'time' ? c.targetHours * 3600 + c.targetMinutes * 60 : undefined,
      matchCategory: c.matchCategory || undefined,
    },
    period: c.period, status: 'active', date, source: 'manual',
    links: c.links, progressSeconds: 0, createdAt: new Date().toISOString(),
    parentId: c.parentId || undefined,
    detection: c.detectionEnabled ? {
      enabled: true, mode: c.detectionMode,
      keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
      minMinutes: c.detectionMinMinutes,
    } : undefined,
  };
}

interface Reminder {
  id: string; text: string; due_date: string | null;
  goal_id: string | null; done: boolean; created_at: string;
}
interface RadarMark { color: string; label: string; }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• unique UI pieces â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/* â€” DayRing: done/total donut for the header â€” */
function DayRing({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="relative shrink-0">
      <AnimatedCircularProgressBar
        value={pct}
        size={46}
        strokeWidth={4}
        gaugePrimaryColor="#fbbf24"
        gaugeSecondaryColor="rgba(63,63,70,0.5)"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-zinc-300 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

/* â€” GoldHeader: opens on the date itself, ledger-style â€” */
function GoldHeader({ date, done, total, tracked, bestStreak }: {
  date: string; done: number; total: number; tracked: number; bestStreak: number;
}) {
  const d = new Date(date + 'T00:00:00');
  return (
    <div className="relative flex items-end justify-between gap-4">
      <div className="flex items-end gap-4">
        <div className="text-center">
          <div className="text-[44px] leading-none font-semibold text-amber-300 tabular-nums">{d.getDate()}</div>
          <div className="warmth-serif italic text-[12px] text-zinc-500 mt-1">
            {d.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
        </div>
        <div className="pb-1">
          <h1 className="warmth-serif text-[20px] text-zinc-200 leading-tight">
            {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h1>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            <NumberTicker value={done} className="text-zinc-300 tabular-nums" /> of{' '}
            <NumberTicker value={total} className="text-zinc-300 tabular-nums" /> sealed
            {tracked > 0 && <span className="text-zinc-600"> Â· {formatTime(tracked)} tracked</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {bestStreak > 0 && (
          <div className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BorderBeam duration={4} size={120} colorFrom="#fbbf24" colorTo="#f59e0b" borderWidth={1.5} className="opacity-40" />
            <Flame size={13} className="text-amber-400" />
            <span className="text-[12px] font-semibold text-amber-300 tabular-nums">
              <NumberTicker value={bestStreak} className="text-amber-300" suffix="d" />
            </span>
          </div>
        )}
        <DayRing done={done} total={total} />
      </div>
    </div>
  );
}

/* â€” WeekBoard: 7 day-columns, habit dot-chips, click to navigate â€” */
function WeekBoard({ weekDates, weekGoals, selectedDate, onPick, onToggleDay }: {
  weekDates: string[];
  weekGoals: Record<string, Goal[]>;
  selectedDate: string;
  onPick: (d: string) => void;
  onToggleDay: (g: Goal) => void;
}) {
  const today = todayStr();
  const dowNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /* regroup weeklyish rows by (parentId || title) across the week */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; category: GoalCategory; days: Record<string, Goal> }>();
    for (const [date, list] of Object.entries(weekGoals || {})) {
      if (!Array.isArray(list)) continue;
      for (const g of list) {
        if (!isWeeklyish(g)) continue;
        const key = g.parentId || g.title;
        if (!map.has(key)) map.set(key, { key, title: g.title, category: g.category, days: {} });
        map.get(key)!.days[date] = g;
      }
    }
    return [...map.values()];
  }, [weekGoals]);

  return (
    <WarmCard ambient>
      <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
        <CalendarDays size={13} className="text-amber-400" />
        The Week
        <span className="text-zinc-600 font-normal ml-1">habits & weekly goals</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((date, i) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const dayList = weekGoals[date] || [];
          const dailyCount = dayList.filter(g => !isWeeklyish(g)).length;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all duration-200 min-h-[92px] ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : isToday
                    ? 'bg-zinc-800/40 border-zinc-700/40'
                    : 'bg-zinc-900/40 border-transparent hover:bg-zinc-800/30 hover:border-zinc-800/50'
              }`}
            >
              <span className={`text-[9px] uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-zinc-600'}`}>
                {dowNames[i]}
              </span>
              <span className={`text-[14px] font-semibold tabular-nums ${isSelected ? 'text-amber-300' : isToday ? 'text-zinc-200' : 'text-zinc-500'}`}>
                {new Date(date + 'T00:00:00').getDate()}
              </span>
              {/* habit dot-chips for this day */}
              <span className="flex flex-col items-center gap-1">
                {groups.slice(0, 4).map(grp => {
                  const inst = grp.days[date];
                  if (!inst) return null;
                  const isDone = inst.status === 'done';
                  return (
                    <span
                      key={grp.key}
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); onToggleDay(inst); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onToggleDay(inst); } }}
                      title={`${grp.title}${isDone ? ' âœ“' : ''}`}
                      className="w-2.5 h-2.5 rounded-[3px] border transition-transform hover:scale-125"
                      style={{
                        background: isDone ? catDot(grp.category) : 'transparent',
                        borderColor: isDone ? catDot(grp.category) : `${catDot(grp.category)}55`,
                      }}
                    />
                  );
                })}
              </span>
              {dailyCount > 0 && (
                <span className="absolute bottom-1 text-[8px] text-zinc-600 tabular-nums">{dailyCount} daily</span>
              )}
            </button>
          );
        })}
      </div>
      {groups.length === 0 && (
        <p className="text-[11px] text-zinc-600 text-center mt-2">
          No habits or weekly goals this week â€” create a goal with period "Weekly" to see it here.
        </p>
      )}
    </WarmCard>
  );
}

/* â€” DeadlineRadar: mini month calendar + countdown list â€” */
function DeadlineRadar({ marks, selectedDate, onPick }: {
  marks: Map<string, RadarMark[]>;
  selectedDate: string;
  onPick: (d: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(selectedDate.slice(0, 7));
  useEffect(() => setViewMonth(selectedDate.slice(0, 7)), [selectedDate]);

  const { lead, dim, y, m } = useMemo(() => {
    const [yy, mm] = viewMonth.split('-').map(Number);
    const first = new Date(yy, mm - 1, 1);
    return { lead: (first.getDay() + 6) % 7, dim: new Date(yy, mm, 0).getDate(), y: yy, m: mm };
  }, [viewMonth]);

  const shiftMonth = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const upcoming = useMemo(() => {
    const all: { date: string; mark: RadarMark }[] = [];
    marks.forEach((list, date) => list.forEach(mark => all.push({ date, mark })));
    return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [marks]);

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = todayStr();

  return (
    <WarmCard ambient>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-medium text-zinc-400 flex items-center gap-1.5">
          <CalendarDays size={13} className="text-amber-400" />
          Deadline Radar
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronLeft size={13} /></button>
          <span className="text-[10px] text-zinc-500 w-[76px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronRight size={13} /></button>
        </div>
      </div>

      {/* month grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-[8px] text-zinc-600 py-0.5">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: dim }).map((_, i) => {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const dayMarks = marks.get(dateStr) || [];
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              onClick={() => onPick(dateStr)}
              className={`relative h-7 rounded-md text-[10px] tabular-nums transition-colors flex flex-col items-center justify-center ${
                isToday ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              {i + 1}
              {dayMarks.length > 0 && (
                <span className="flex gap-0.5 absolute bottom-0.5">
                  {dayMarks.slice(0, 3).map((mk, j) => (
                    <span key={j} className="w-1 h-1 rounded-full" style={{ background: mk.color }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* countdown list */}
      <div className="mt-3 space-y-1.5 border-t border-zinc-800/50 pt-2">
        {upcoming.length === 0 ? (
          <p className="text-[11px] text-zinc-600 text-center py-1">Nothing on the horizon</p>
        ) : (
          upcoming.map(({ date, mark }, i) => {
            const du = daysUntil(date);
            const overdue = du < 0;
            return (
              <button
                key={i}
                onClick={() => onPick(date)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/40 transition-colors text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mark.color }} />
                <span className="flex-1 text-[11px] text-zinc-400 truncate">{mark.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 tabular-nums ${
                  overdue
                    ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse'
                    : du <= 3
                      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                      : 'text-zinc-500 border-zinc-700/50'
                }`}>
                  {overdue ? `${-du}d overdue` : du === 0 ? 'today' : `in ${du}d`}
                </span>
              </button>
            );
          })
        )}
      </div>
    </WarmCard>
  );
}

/* â€” TheVault: long-term goals as progress rings â€” */
function ProgressRing({ pct }: { pct: number }) {
  return (
    <div className="relative shrink-0">
      <AnimatedCircularProgressBar
        value={Math.min(100, pct)}
        size={38}
        strokeWidth={3.5}
        gaugePrimaryColor="#fbbf24"
        gaugeSecondaryColor="rgba(63,63,70,0.5)"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-semibold text-zinc-300 tabular-nums">
        {Math.round(pct)}
      </span>
    </div>
  );
}

interface LTGForm {
  title: string;
  description: string;
  category: GoalCategory;
  priority: number;
  deadline: string;
}
const emptyLTGForm: LTGForm = { title: '', description: '', category: 'work', priority: 1, deadline: '' };

const PRIORITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Top' },
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Low' },
];

function TheVault({ longTermGoals, todayGoals, onSave, onDelete }: {
  longTermGoals: LongTermGoal[];
  todayGoals: Goal[];
  onSave: (form: LTGForm, existing?: LongTermGoal) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState<LTGForm>(emptyLTGForm);
  const [saving, setSaving] = useState(false);

  const startAdd = () => { setForm(emptyLTGForm); setEditingId(null); setAdding(true); };
  const startEdit = (ltg: LongTermGoal) => {
    setForm({
      title: ltg.title,
      description: ltg.description || '',
      category: ltg.category || 'work',
      priority: ltg.priority ?? 1,
      deadline: ltg.deadline || '',
    });
    setAdding(false); setEditingId(ltg.id);
  };
  const cancel = () => { setAdding(false); setEditingId(null); setConfirmId(null); };

  const submit = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const existing = editingId ? longTermGoals.find(g => g.id === editingId) : undefined;
    const ok = await onSave(form, existing);
    setSaving(false);
    if (ok) { setAdding(false); setEditingId(null); }
  };

  const armDelete = (id: string) => {
    setConfirmId(id);
    window.setTimeout(() => setConfirmId(c => (c === id ? null : c)), 3000);
  };

  return (
    <WarmCard ambient>
      <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
        <TrendingUp size={13} className="text-amber-400" />
        The Vault
        <span className="text-zinc-600 font-normal ml-1">long-term</span>
        <button
          onClick={startAdd}
          title="Add long-term goal"
          className="ml-auto p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {(adding || editingId) && (
        <div className="mb-2 space-y-1.5">
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Long-term goal titleâ€¦"
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <div className="flex gap-1.5">
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as GoalCategory }))}
              className="flex-1 min-w-0 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
            >
              {Object.keys(CAT_META).map(k => (
                <option key={k} value={k}>{CAT_META[k].label}</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={form.deadline}
            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 [color-scheme:dark] transition-colors"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Description (optional)â€¦"
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <div className="flex gap-1.5">
            <button
              onClick={submit}
              disabled={!form.title.trim() || saving}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-medium transition-colors"
            >
              {saving ? 'Savingâ€¦' : editingId ? 'Save changes' : 'Add goal'}
            </button>
            <button
              onClick={cancel}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 text-[11px] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {longTermGoals.length === 0 ? (
        <p className="text-[11px] text-zinc-600 text-center py-2">No long-term goals yet â€” tap + to add one.</p>
      ) : (
        <div className="space-y-2">
          {longTermGoals.map(ltg => {
            const serving = todayGoals.filter(g => g.parentId === ltg.id).length;
            const du = ltg.deadline ? daysUntil(ltg.deadline) : null;
            return (
              <div key={ltg.id} className="group flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                <ProgressRing pct={ltg.progress ?? 0} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-300 truncate">{ltg.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: catDot(ltg.category || 'work') }} />
                    <span className="text-[9px] text-zinc-600">{(CAT_META[ltg.category || 'work'] || CAT_META.work).label}</span>
                    {du !== null && (
                      <span className={`text-[9px] tabular-nums ${du < 0 ? 'text-red-400' : du <= 7 ? 'text-amber-300' : 'text-zinc-600'}`}>
                        {du < 0 ? `${-du}d overdue` : `${du}d left`}
                      </span>
                    )}
                  </div>
                </div>
                {serving > 0 && (
                  <span className="text-[9px] text-amber-400/80 shrink-0" title="daily goals serving this">
                    âš¡ {serving}
                  </span>
                )}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(ltg)}
                    title="Edit goal"
                    className="p-1 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  {confirmId === ltg.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => { const ok = await onDelete(ltg.id); if (ok) setConfirmId(null); }}
                        className="px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/25 text-[10px] hover:bg-red-500/25 transition-colors"
                      >
                        Sure?
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => armDelete(ltg.id)}
                      title="Delete goal"
                      className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WarmCard>
  );
}

/* â€” BellBoard: reminders as tickets with amber time-rail â€” */
function BellBoard({ reminders, onCreate, onToggle, onDelete }: {
  reminders: Reminder[];
  onCreate: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const add = () => { if (text.trim()) { onCreate(text.trim()); setText(''); } };

  return (
    <WarmCard className="border-amber-500/20 relative overflow-hidden">
      {reminders.some(r => !r.done) && (
        <BorderBeam duration={5} size={150} colorFrom="#fbbf24" colorTo="#f59e0b" borderWidth={1.5} className="opacity-30" />
      )}
      <div className="text-[12px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
        <Bell size={13} className="text-amber-400" />
        Bell Board
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Ring a reminderâ€¦"
          className="flex-1 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>
      {reminders.length === 0 ? (
        <p className="text-[11px] text-zinc-600 text-center py-2">All quiet â€” no reminders</p>
      ) : (
        <div className="space-y-1.5">
          {reminders.map(r => (
            <div
              key={r.id}
              className="group flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg bg-zinc-900/30 border-l-2 hover:bg-zinc-800/30 transition-colors"
              style={{ borderLeftColor: r.done ? '#3f3f46' : '#fbbf24' }}
            >
              <button
                onClick={() => onToggle(r.id, !r.done)}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  r.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-amber-400/60'
                }`}
              >
                {r.done && <CheckCircle2 size={9} className="text-white" />}
              </button>
              <span className={`flex-1 text-[12px] truncate ${r.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{r.text}</span>
              {r.due_date && (
                <span className={`text-[8px] px-1 py-0.5 rounded-full tabular-nums shrink-0 ${
                  daysUntil(r.due_date) < 0 && !r.done ? 'text-red-400 bg-red-500/10' : 'text-zinc-600 bg-zinc-800/60'
                }`}>
                  {r.due_date.slice(5)}
                </span>
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

/* â€” ReflectionCard: soft journal + hard stats + smart prompts, one surface â€” */
function ReflectionCard({ date, data, summary, onSave }: {
  date: string; data: DailyReflection; summary: string; onSave: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [promptOpen, setPromptOpen] = useState(true);
  const streak = covenantStreak();
  const prompts = useMemo(() => buildPrompts(data, streak), [data, streak]);
  const text = draft[date] ?? summary;
  const dirty = draft[date] !== undefined;

  const tiles: { icon: typeof Timer; label: string; value: string; tint: string }[] = [
    { icon: Timer,    label: 'Productive',  value: formatTime(data.productiveSec), tint: '#fbbf24' },
    { icon: Code2,    label: 'Coding',      value: formatTime(data.codingSec),     tint: '#22d3ee' },
    { icon: Target,   label: 'Goals',       value: `${data.goals.completed}/${data.goals.total}`, tint: '#34d399' },
    { icon: Activity, label: 'Habits',      value: `${data.habits.completed}/${data.habits.total}`, tint: '#8b5cf6' },
    { icon: Flame,    label: 'Covenant',    value: `${streak}d`,                   tint: '#f97316' },
  ];

  return (
    <WarmCard ambient>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
          <NotebookPen size={13} className="text-amber-400" />
          Reflect on {prettyDate(date).toLowerCase()}
          <span className="warmth-serif italic text-zinc-600 font-normal hidden sm:inline">â€” was it purposeful?</span>
        </div>
        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              onClick={() => { onSave(text); setDraft(prev => { const c = { ...prev }; delete c[date]; return c; }); }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[10px] font-medium transition-colors"
            >
              Save entry
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* hard stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 px-2.5 py-2">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 mb-1">
              <t.icon size={11} style={{ color: t.tint }} />
              {t.label}
            </div>
            <div className="text-[14px] font-semibold text-zinc-200 tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>

      {/* journal */}
      <VoiceInputWrapper>
        <textarea
          value={text}
          onChange={e => { setDraft(prev => ({ ...prev, [date]: e.target.value })); }}
          rows={3}
          placeholder="How did the day go? What moved the needle? What does tomorrow need?"
          className="warmth-serif w-full bg-transparent outline-none resize-none text-[14px] leading-[28px] text-zinc-300 placeholder:text-zinc-700 placeholder:italic"
          style={{
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(63,63,70,0.25) 27px, rgba(63,63,70,0.25) 28px)',
          }}
        />
      </VoiceInputWrapper>

      {/* smart prompts */}
      {prompts.length > 0 && (
        <div className="mt-3 border-t border-zinc-800/50 pt-2.5">
          <button
            onClick={() => setPromptOpen(o => !o)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-amber-300 transition-colors mb-1.5"
          >
            <Lightbulb size={11} className="text-amber-500/80" />
            {promptOpen ? 'hide' : 'show'} prompts for today
            {promptOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <AnimatePresence>
            {promptOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1.5">
                {prompts.map((p, i) => (
                  <motion.button
                    key={p}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={() => setDraft(prev => {
                      const cur = prev[date] ?? summary;
                      return { ...prev, [date]: cur ? `${cur}\n\n${p}` : p };
                    })}
                    className="w-full text-left text-[12px] text-zinc-400 hover:text-amber-300 hover:bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-zinc-800/40 hover:border-amber-500/25 transition-colors"
                  >
                    <Sparkles size={11} className="inline mr-1.5 text-amber-500/70" />
                    {p}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </WarmCard>
  );
}

/* â€” WeekReview: Monâ†’Sun hard-data recap with covenant streak dots â€” */
function WeekReview({ weekDates, reflections }: {
  weekDates: string[];
  reflections: Record<string, DailyReflection>;
}) {
  const doneDates = covenantDoneDates();
  const streak = covenantStreak();
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxProd = Math.max(1, ...weekDates.map(d => reflections[d]?.productiveSec || 0));
  const avgProd = weekDates.reduce((s, d) => s + (reflections[d]?.productiveSec || 0), 0) / 7;
  const goalsSealed = weekDates.reduce((s, d) => s + (reflections[d]?.goals.completed || 0), 0);
  const habitsKept = weekDates.reduce((s, d) => s + (reflections[d]?.habits.completed || 0), 0);

  return (
    <WarmCard>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
          <TrendingUp size={13} className="text-amber-400" />
          This week, at a glance
          <span className="warmth-serif italic text-zinc-600 font-normal">â€” Monday to Sunday</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {weekDates.map((d, i) => {
          const ref = reflections[d];
          const prod = ref?.productiveSec || 0;
          const isToday = d === todayStr();
          return (
            <div key={d} className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg ${isToday ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-zinc-900/30'}`}>
              <div className="w-11 shrink-0">
                <div className={`text-[9px] uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-zinc-600'}`}>{dow[i]}</div>
                <div className={`text-[11px] font-semibold tabular-nums ${isToday ? 'text-amber-300' : 'text-zinc-500'}`}>{d.slice(5)}</div>
              </div>
              <div className="flex-1 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((prod / maxProd) * 100)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: prod > 0 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'transparent' }}
                />
              </div>
              <div className="w-12 text-right text-[11px] tabular-nums text-zinc-400">{prod > 0 ? formatTime(prod) : 'â€”'}</div>
              <div className="w-6 text-center text-[11px] tabular-nums text-emerald-400">{ref?.goals.completed || ''}</div>
              <div className="w-5 text-center">
                {doneDates.has(d)
                  ? <Flame size={12} className="inline text-amber-400" />
                  : <span className="text-zinc-700">Â·</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-2.5 border-t border-zinc-800/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>avg <span className="text-zinc-300 tabular-nums">{formatTime(Math.round(avgProd))}</span>/day</span>
        <span><span className="text-emerald-400 tabular-nums">{goalsSealed}</span> goals sealed</span>
        <span><span className="text-violet-400 tabular-nums">{habitsKept}</span> habits kept</span>
        <span className="flex items-center gap-1"><Flame size={12} className="text-amber-400" /> <span className="text-amber-300 tabular-nums">{streak}</span> day streak</span>
      </div>
    </WarmCard>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• main component â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function GoldPage({ embedded }: { embedded?: boolean }) {
  const api = (window as any).deskflowAPI;

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
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

  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* â”€â”€ loading â”€â”€ */
  const loadGoals = useCallback(async (date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.getGoals(date);
      setGoals(res.goals || []);
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
  }, [api, loadLongTerm]);

  /* â”€â”€ CRUD (optimistic) â”€â”€ */
  const handleAdd = async () => {
    if (!newCriteria.title.trim()) return;
    const goal = criteriaToGoal(newCriteria, selectedDate);
    setGoals(prev => [...prev, goal]);
    setIsAdding(false); setNewCriteria(defaultCriteria);
    try {
      await api.saveGoal(selectedDate, goal);
      confetti({ particleCount: 50, spread: 80, startVelocity: 35, colors: ['#fbbf24', '#f59e0b', '#34d399', '#a78bfa'] });
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
    try { await api.saveGoal(selectedDate, { ...goal, status: newStatus, completedAt }); loadWeek(selectedDate); }
    catch { setGoals(prev => prev.map(g => (g.id === id ? goal : g))); }
  };

  const handleDelete = async (id: string) => {
    const removed = goals.find(g => g.id === id);
    setGoals(prev => prev.filter(g => g.id !== id));
    try { await api.deleteGoal(id); loadWeek(selectedDate); }
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
        matchCategory: editCriteria.matchCategory || undefined,
      },
      parentId: editCriteria.parentId || undefined,
      detection: editCriteria.detectionEnabled ? {
        enabled: true, mode: editCriteria.detectionMode,
        keywords: editCriteria.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
        minMinutes: editCriteria.detectionMinMinutes,
      } : undefined,
    };
    setGoals(prev => prev.map(g => (g.id === editingId ? updated : g)));
    setEditingId(null);
    try { await api.saveGoal(selectedDate, updated); loadWeek(selectedDate); }
    catch { setGoals(prev => prev.map(g => (g.id === editingId ? existing : g))); }
  };

  /* toggle a habit instance on a specific day (WeekBoard) */
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

  /* â”€â”€ reminders â”€â”€ */
  const createReminder = async (text: string) => {
    try {
      const res = await api.createReminder({ text, dueDate: selectedDate });
      if (res.reminder) setReminders(prev => [...prev, { ...res.reminder, due_date: res.reminder.dueDate, created_at: new Date().toISOString() }]);
    } catch {}
  };
  const toggleReminder = async (id: string, done: boolean) => {
    setReminders(prev => prev.map(r => (r.id === id ? { ...r, done } : r)));
    try { await api.updateReminder(id, { done }); } catch {}
  };
  const deleteReminder = async (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    try { await api.deleteReminder(id); } catch {}
  };

  /* â”€â”€ long-term goals (Vault) â”€â”€ */
  const handleLTGSave = useCallback(async (form: LTGForm, existing?: LongTermGoal) => {
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

  /* â”€â”€ derived â”€â”€ */
  const dailies = useMemo(() => goals.filter(g => !isWeeklyish(g) && g.status !== 'suggested'), [goals]);
  const activeDailies = dailies.filter(g => g.status !== 'done');
  const completedDailies = dailies.filter(g => g.status === 'done');
  const doneCount = goals.filter(g => g.status === 'done').length;
  const tracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const bestStreak = goals.reduce((mx, g) => Math.max(mx, g.streak || 0), 0);
  const weekDates = useMemo(() => {
    const mon = mondayOf(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDaysStr(mon, i));
  }, [selectedDate]);

  /* fetch hard stats for the whole Monâ†’Sun week for the recap */
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

  /* radar marks: reminder due dates (amber) + long-term deadlines (violet) */
  const radarMarks = useMemo(() => {
    const m = new Map<string, RadarMark[]>();
    const push = (date: string, mark: RadarMark) => {
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(mark);
    };
    reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: '#fbbf24', label: r.text }); });
    longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: '#a78bfa', label: l.title }); });
    return m;
  }, [reminders, longTermGoals]);

  /* â”€â”€ render â”€â”€ */
  return (
    <div className="space-y-4">
      <GoldHeader date={selectedDate} done={doneCount} total={goals.length} tracked={tracked} bestStreak={bestStreak} />

      <CalendarStrip selectedDate={selectedDate} onDateChange={setSelectedDate}
        goalDates={new Set(Object.keys(weekGoals))} />

      <AnimatePresence>
        {focusState?.isActive && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            {focusState.isBroken
              ? 'Focus session broken â€” progress paused'
              : `Focus session live â€” tracking ${activeGoalIds.length} goal${activeGoalIds.length !== 1 ? 's' : ''}`}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 items-start">
        {/* left rail */}
        <div className="w-[250px] shrink-0 space-y-3 hidden lg:block">
          <DeadlineRadar marks={radarMarks} selectedDate={selectedDate} onPick={setSelectedDate} />
          <TheVault longTermGoals={longTermGoals} todayGoals={goals}
            onSave={handleLTGSave} onDelete={handleLTGDelete} />
          <BellBoard reminders={reminders} onCreate={createReminder} onToggle={toggleReminder} onDelete={deleteReminder} />
        </div>

        {/* main column */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-zinc-300">
              {prettyDate(selectedDate)}
              <span className="text-zinc-600 font-normal ml-2 text-[12px]">
                {activeDailies.length} open Â· {completedDailies.length} sealed
              </span>
            </h2>
            <button
              onClick={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-[12px] font-medium transition-colors"
            >
              <Plus size={13} /> Add Goal
            </button>
          </div>

          <AnimatePresence>
            {isAdding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <WarmCard ambient>
                  <CriteriaBuilder
                    value={newCriteria} onChange={setNewCriteria} onSave={handleAdd}
                    onCancel={() => setIsAdding(false)}
                    longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                  />
                </WarmCard>
              </motion.div>
            )}
          </AnimatePresence>

          <WeekBoard
            weekDates={weekDates} weekGoals={weekGoals} selectedDate={selectedDate}
            onPick={setSelectedDate} onToggleDay={handleToggleDay}
          />

          {loading ? (
            <GoalCardSkeleton />
          ) : error ? (
            <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
          ) : dailies.length === 0 ? (
            <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} />
          ) : (
            <>
              <div className="space-y-2">
                {activeDailies.map(goal => (
                  <div key={goal.id} className="relative">
                    {editingId === goal.id ? (
                      <WarmCard ambient>
                        <CriteriaBuilder
                          value={editCriteria} onChange={setEditCriteria} onSave={handleEditSave}
                          onCancel={() => setEditingId(null)}
                          longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                          isEditing
                        />
                      </WarmCard>
                    ) : (
                      <>
                        <GoalCard
                          goal={goal} onToggle={handleToggle} onDelete={handleDelete} onEdit={handleEditStart}
                          longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                        />
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

              {completedDailies.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowCompleted(p => !p)}
                    className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Sealed ({completedDailies.length})
                  </button>
                  <AnimatePresence>
                    {showCompleted && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2 mt-2">
                        {completedDailies.map(goal => (
                          <GoalCard key={goal.id} goal={goal} onToggle={handleToggle} onDelete={handleDelete}
                            onEdit={handleEditStart}
                            longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          <ReflectionCard date={selectedDate} data={reflection} summary={reviewSummary}
            onSave={async s => { setReviewSummary(s); try { await api.saveGoalReview(selectedDate, s); } catch {} }} />

          <WeekReview weekDates={weekDates} reflections={weekReflections} />
        </div>
      </div>

      <LifeRiver />
    </div>
  );
}

```

