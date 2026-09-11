# CONTEXT_BUNDLE.md - Gold Page Redesign
> Generated: 2026-08-27 | Target AI has ZERO repo access - this bundle is all it has.

---

## 1. Design Tokens

Amber accent: #fbbf24 (primary), #f59e0b (secondary)
Glass: bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]
Typography: Geist font. sectionTitle=text-[13px] font-semibold text-zinc-200. header=warmth-serif text-[20px] text-zinc-200. dateBig=text-[44px] font-semibold text-amber-300 tabular-nums.
Categories: work=#ec4899, personal=#8b5cf6, health=#34d399, learning=#22d3ee, finance=#fbbf24, relationships=#fb7185

## 2. IPC Channels

| Method | Purpose |
|---|---|
| getGoals(date) | Goals for a day |
| getGoalsBatch(start,end) | Goals for date range |
| getLongtermGoals() | Vault goals |
| saveGoal(date,goal) | Create/update goal |
| deleteGoal(id) | Delete goal |
| getReminders() | All reminders |
| createReminder({text,dueDate}) | Create reminder |
| toggleReminder(id,done) | Toggle reminder |
| deleteReminder(id) | Delete reminder |
| getDeadlines({days}) | Upcoming deadlines |
| getSchedule() | Schedule entries |
| addScheduleEntry(entry) | Add schedule |
| getGoalReview(date) | AI review |
| saveGoalReview(date,text) | Save journal |
| getDailyReflection(date) | Hard stats |
| getHabits(start,end) | Habits for range |
| goalAiMonitor() | AI health check |
| goalAiParseLanguage(text) | NL to goal config |

## 3. Component Hierarchy

GoldPage > GoldHeader, CalendarStrip, GoalsSection (duplicates internals), ReflectionCard, WeekReview, LifeRiver, TheVault
GoalsSection > StatPill x4, ScheduleCard>SpotlightCard, GoalLanguageParser, CriteriaBuilder, MissedGoalRecoveryBanner, GoalCard x N, HabitTracker, GoalAICoach

## 4. Source Files

---

### FILE: src\features\warmth\gold\GoldPage.tsx (1389 lines)

```tsx
// src/features/warmth/gold/GoldPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target, Flame, Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { ExternalAIBridgeField } from '../../../features/content-engine/components/ExternalAIBridgeField';
  CalendarDays, Calendar, NotebookPen, TrendingUp, ChevronLeft, ChevronRight,
  Sparkles, Lightbulb, Timer, Code2, Activity, Pencil, X,
} from 'lucide-react';
import { WarmCard } from '../WarmCard';
import { CalendarStrip } from '../../../components/goals/CalendarStrip';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../../../components/goals/GoalCard';
import { CriteriaBuilder } from '../../../components/goals/CriteriaBuilder';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import { MissedGoalRecoveryBanner } from '../../../components/goals/MissedGoalRecoveryBanner';
import { getMissedGoals } from '../../../components/goals/GoalCompletionEngine';
import { HabitTracker } from '../../../components/goals/HabitTracker';
import { GoalAICoach } from '../../../components/goals/GoalAICoach';
import { GoalLanguageParser } from '../../../components/goals/GoalLanguageParser';
import { GoalsSection } from '../../../components/goals/GoalsSection';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import { confetti } from '../../../components/ui/confetti';
import { NumberTicker } from '../../../components/ui/number-ticker';
import { BorderBeam } from '../../../components/ui/border-beam';
import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper';
import type { Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';
import { loadCompletions } from '../../covenant/storage';
import { LifeRiver } from '../../../components/life-river/river';

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

/* ── daily reflection (hard stats) ── */
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

/* smart prompt generation — blend soft + hard into 4 max reflection prompts */
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

/* species predicate — this is the whole routing logic */
const isWeeklyish = (g: Goal) => !!g.isHabit || g.cadence === 'weekly' || g.period === 'weekly';

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
  trackingMode: 'manual',
  completionLogic: { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, streakOnMiss: 'reset' },
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
    },
    period: c.period, status: 'active', date, source: 'manual',
    links: c.links, progressSeconds: 0, createdAt: new Date().toISOString(),
    parentId: c.parentIds[0] || undefined,
    parentIds: c.parentIds.length ? c.parentIds : undefined,
    detection: c.detectionEnabled ? {
      enabled: true, mode: c.detectionMode,
      keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
      minMinutes: c.detectionMinMinutes,
    } : undefined,
    externalActivityId: c.externalActivityId ?? null,
    trackingMode: c.trackingMode,
    completionLogic: c.completionLogic,
    cadenceConfig: c.cadenceConfig,
    crossFeatureLink: c.crossFeatureLink ?? null,
  };
}

interface RadarMark { color: string; label: string; }

/* ═══════════════════ unique UI pieces ═══════════════════ */

/* — DayRing: done/total donut for the header — */
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

/* — GoldHeader: opens on the date itself, ledger-style — */
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
            {tracked > 0 && <span className="text-zinc-600"> · {formatTime(tracked)} tracked</span>}
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

/* — WeekBoard: 7 day-columns, habit dot-chips, click to navigate — */
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
                      title={`${grp.title}${isDone ? ' ✓' : ''}`}
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
          No habits or weekly goals this week — create a goal with period "Weekly" to see it here.
        </p>
      )}
    </WarmCard>
  );
}

/* — DeadlineRadar: mini month calendar + countdown list — */
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

/* — TheVault: long-term goals as progress rings — */
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

export interface LTGForm {
  title: string;
  description: string;
  category: GoalCategory;
  priority: number;
  deadline: string;
}
export const emptyLTGForm: LTGForm = { title: '', description: '', category: 'work', priority: 1, deadline: '' };

export const PRIORITY_OPTIONS: { value: number; label: string }[] = [
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
            placeholder="Long-term goal title…"
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <ExternalAIBridgeField
            fieldName="title"
            label="Goal Title"
            value={form.title}
            onUpdate={(v) => setForm(f => ({ ...f, title: v }))}
            allFields={{ title: form.title, category: form.category, priority: String(form.priority), deadline: form.deadline, description: form.description }}
            category="goals"
            context="Help define a clear, measurable long-term goal"
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
            placeholder="Description (optional)…"
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <ExternalAIBridgeField
            fieldName="description"
            label="Goal Description"
            value={form.description}
            onUpdate={(v) => setForm(f => ({ ...f, description: v }))}
            allFields={{ title: form.title, category: form.category, priority: String(form.priority), deadline: form.deadline, description: form.description }}
            category="goals"
            context="Write a clear description for this goal"
          />
          <div className="flex gap-1.5">
            <button
              onClick={submit}
              disabled={!form.title.trim() || saving}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-medium transition-colors"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add goal'}
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
        <p className="text-[11px] text-zinc-600 text-center py-2">No long-term goals yet — tap + to add one.</p>
      ) : (
        <div className="space-y-2">
          {longTermGoals.map(ltg => {
            const serving = todayGoals.filter(g => g.parentIds?.includes(ltg.id) || g.parentId === ltg.id).length;
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
                    ⚡ {serving}
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

/* — BellBoard: reminders as tickets with amber time-rail — */
function BellBoard({ reminders, onCreate, onToggle, onDelete, selectedDate }: {
  reminders: Reminder[];
  onCreate: (text: string, dueDate?: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  selectedDate?: string;
}) {
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState(selectedDate || '');
  const add = () => { if (text.trim()) { onCreate(text.trim(), dueDate || undefined); setText(''); setDueDate(selectedDate || ''); } };

  const formatDisplayDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const quickDates = useMemo(() => {
    const today = todayStr();
    const tomorrow = addDaysStr(today, 1);
    const nextWeek = addDaysStr(today, 7);
    return [
      { label: 'Today', value: today },
      { label: 'Tomorrow', value: tomorrow },
      { label: 'Next week', value: nextWeek },
    ];
  }, []);

  return (
    <WarmCard ambient>
      <div className="text-[12px] font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
        <Bell size={13} className="text-amber-400" />
        Events & Reminders
        {reminders.filter(r => !r.done).length > 0 && (
          <span className="ml-auto text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            {reminders.filter(r => !r.done).length} active
          </span>
        )}
      </div>

      {/* Input area — date picker always visible */}
      <div className="space-y-2 mb-3">
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="What's happening? (event, reminder, task…)"
          className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
        />

        {/* Date picker — always visible */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-1.5">
            <Calendar size={12} className="text-amber-400/70 shrink-0" />
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
            {dueDate && (
              <button onClick={() => setDueDate('')} className="text-zinc-600 hover:text-zinc-400">
                <X size={11} />
              </button>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 shrink-0">
            {dueDate ? formatDisplayDate(dueDate) : 'Pick a date'}
          </span>
        </div>

        {/* Quick date chips */}
        <div className="flex items-center gap-1.5">
          {quickDates.map(qd => (
            <button
              key={qd.value}
              onClick={() => setDueDate(dueDate === qd.value ? '' : qd.value)}
              className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                dueDate === qd.value
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-900/40 text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/50'
              }`}
            >
              {qd.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={add}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[12px] font-medium"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>

      {/* Reminders list */}
      {reminders.length === 0 ? (
        <div className="text-center py-4">
          <Bell size={20} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-[11px] text-zinc-600">No reminders yet</p>
          <p className="text-[10px] text-zinc-700 mt-0.5">Add one above to get started</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {reminders.map(r => {
            const isOverdue = r.due_date && daysUntil(r.due_date) < 0 && !r.done;
            const isToday = r.due_date && daysUntil(r.due_date) === 0 && !r.done;
            return (
              <div
                key={r.id}
                className={`group flex items-center gap-2 pl-2.5 pr-1.5 py-2 rounded-lg border-l-2 transition-colors ${
                  r.done ? 'bg-zinc-900/20 border-l-zinc-800' : isOverdue ? 'bg-rose-500/5 border-l-rose-500/50' : isToday ? 'bg-amber-500/5 border-l-amber-500/50' : 'bg-zinc-900/30 border-l-amber-500/30 hover:bg-zinc-800/30'
                }`}
              >
                <button
                  onClick={() => onToggle(r.id, !r.done)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    r.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-amber-400/60'
                  }`}
                >
                  {r.done && <CheckCircle2 size={10} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] block truncate ${r.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>{r.text}</span>
                  {r.due_date && (
                    <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                      isOverdue ? 'text-rose-400' : isToday ? 'text-amber-400' : 'text-zinc-500'
                    }`}>
                      <Calendar size={9} />
                      {formatDisplayDate(r.due_date)}
                      {isOverdue && <span className="text-[9px] text-rose-400/70">(overdue)</span>}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </WarmCard>
  );
}

/* — ReflectionCard: soft journal + hard stats + smart prompts, one surface — */
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
          <span className="warmth-serif italic text-zinc-600 font-normal hidden sm:inline">— was it purposeful?</span>
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
      <div className="flex items-start gap-2">
        <VoiceInputWrapper className="flex-1">
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
        <ExternalAIBridgeField
          fieldName="journal"
          label="Journal Entry"
          value={text}
          onUpdate={(v) => setDraft(prev => ({ ...prev, [date]: v }))}
          allFields={{ journal: text, date }}
          category="goals"
          context="Help write a reflective journal entry about today's progress"
        />
      </div>

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

/* — WeekReview: Mon→Sun hard-data recap with covenant streak dots — */
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
          <span className="warmth-serif italic text-zinc-600 font-normal">— Monday to Sunday</span>
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
              <div className="w-12 text-right text-[11px] tabular-nums text-zinc-400">{prod > 0 ? formatTime(prod) : '—'}</div>
              <div className="w-6 text-center text-[11px] tabular-nums text-emerald-400">{ref?.goals.completed || ''}</div>
              <div className="w-5 text-center">
                {doneDates.has(d)
                  ? <Flame size={12} className="inline text-amber-400" />
                  : <span className="text-zinc-700">·</span>}
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

/* ═══════════════════ main component ═══════════════════ */

export default function GoldPage({ embedded }: { embedded?: boolean }) {
  const api = (window as any).deskflowAPI;

  const [selectedDate, setSelectedDate] = useState(todayStr);
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
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* ── loading ── */
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
    (async () => {
      try { const res = await api.getDeadlines({ days: 60 }); setDeadlines(res.deadlines || []); } catch {}
    })();
    (async () => {
      try { const res = await api.getSchedule(); setSchedule(res.entries || []); } catch {}
    })();
  }, [api, loadLongTerm]);

  /* ── CRUD (optimistic) ── */
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

  /* ── schedule ── */
  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>) => {
    try {
      const res = await api.addScheduleEntry(entry);
      if (res?.success && res.id) {
        setSchedule(prev => [...prev, { ...entry, id: res.id, createdAt: new Date().toISOString() }]);
      }
    } catch {}
  };
  const updateScheduleEntry = async (id: string, patch: Partial<ScheduleEntry>) => {
    setSchedule(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));
    try { await api.updateScheduleEntry(id, patch); } catch {}
  };
  const deleteScheduleEntry = async (id: string) => {
    setSchedule(prev => prev.filter(e => e.id !== id));
    try { await api.deleteScheduleEntry(id); } catch {}
  };

  /* ── long-term goals (Vault) ── */
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

  /* fetch hard stats for the whole Mon→Sun week for the recap */
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

  /* radar marks: deadlines (rose) + reminders (amber) + long-term deadlines (violet) */
  const radarMarks = useMemo(() => {
    const m = new Map<string, RadarMark[]>();
    const push = (date: string, mark: RadarMark) => {
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(mark);
    };
    deadlines.forEach(d => { if (d.due_date && d.status !== 'completed') push(d.due_date, { color: '#f43f5e', label: d.title }); });
    reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: '#fbbf24', label: r.text }); });
    longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: '#a78bfa', label: l.title }); });
    return m;
  }, [deadlines, reminders, longTermGoals]);

  /* ── render ── */
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
              ? 'Focus session broken — progress paused'
              : `Focus session live — tracking ${activeGoalIds.length} goal${activeGoalIds.length !== 1 ? 's' : ''}`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ GOALS SECTION — properly designed with design skills ═══ */}
      <GoalsSection
        goals={goals}
        longTermGoals={longTermGoals}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onSaveGoal={async (date, goal) => { await api.saveGoal(date, goal); loadGoals(date); }}
        onDeleteGoal={async (id) => { await api.deleteGoal(id); loadGoals(selectedDate); }}
        onRefresh={() => loadGoals(selectedDate)}
        loading={loading}
        error={error}
        activeGoalIds={activeGoalIds}
        getAccumulatedSeconds={getAccumulatedSeconds}
        reminders={reminders}
        onCreateReminder={createReminder}
        onToggleReminder={toggleReminder}
        onDeleteReminder={deleteReminder}
        schedule={schedule}
        onAddSchedule={addScheduleEntry}
        onUpdateSchedule={updateScheduleEntry}
        onDeleteSchedule={deleteScheduleEntry}
        radarMarks={radarMarks}
        linkedGoals={goals.map(g => ({ id: g.id, title: g.title }))}
      />

      <ReflectionCard date={selectedDate} data={reflection} summary={reviewSummary}
            onSave={async s => { setReviewSummary(s); try { await api.saveGoalReview(selectedDate, s); } catch {} }} />

          <WeekReview weekDates={weekDates} reflections={weekReflections} />

          {/* River of Years — embedded phases */}
          <LifeRiver />

          {/* The Vault — long-term goals */}
          <TheVault longTermGoals={longTermGoals} todayGoals={goals}
            onSave={handleLTGSave} onDelete={handleLTGDelete} />
      </div>
  );
}

```

---

### FILE: src\components\goals\GoalsSection.tsx (462 lines)

```tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Flame, Plus, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Sparkles, Zap, Activity, BookOpen, Code, DollarSign, AlertTriangle,
  RefreshCw, CalendarDays, Settings2, Wand2, X
} from 'lucide-react';
import type { Goal, LongTermGoal, GoalCategory, TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink } from '../../types/goals';
import { DEFAULT_COMPLETION_LOGIC, DEFAULT_CADENCE_CONFIG } from '../../types/goals';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from './GoalCard';
import { CriteriaBuilder, type CriteriaForm } from './CriteriaBuilder';
import { MissedGoalRecoveryBanner } from './MissedGoalRecoveryBanner';
import { getMissedGoals, formatGracePeriod, formatStreakRule } from './GoalCompletionEngine';
import { HabitTracker } from './HabitTracker';
import { GoalAICoach } from './GoalAICoach';
import { GoalLanguageParser } from './GoalLanguageParser';
import { ScheduleCard } from '../../pages/dashboard/ScheduleCard';

/* ─── Design tokens (Frontend Design skill §DeskFlow Conventions) ─── */
const GLASS = 'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]';
const GLASS_HOVER = 'hover:border-zinc-600/60 transition-all duration-200';
const ACCENT_AMBER = 'text-amber-400';
const ACCENT_VIOLET = 'text-violet-400';
const ACCENT_EMERALD = 'text-emerald-400';
const ACCENT_CYAN = 'text-cyan-400';
const ACCENT_ROSE = 'text-rose-400';

/* ─── Typography (Impeccable skill §Typography — Geist 13px base, 600 headings) ─── */
const TYPE = {
  sectionTitle: 'text-[13px] font-semibold text-zinc-200 tracking-tight',
  badge: 'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
  meta: 'text-[11px] text-zinc-500',
  body: 'text-[12px] text-zinc-300',
  small: 'text-[10px] text-zinc-600',
} as const;

/* ─── Category colors (Human-Centric §Visual Hierarchy — one accent per category) ─── */
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  personal: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  health: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  learning: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  finance: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  relationships: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

/* ─── Tracking mode badges (Human-Centric §Progressive Disclosure) ─── */
const TRACKING_BADGES: Record<string, { icon: string; label: string; color: string }> = {
  system: { icon: '⚙️', label: 'Auto', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  hybrid: { icon: '🔄', label: 'Hybrid', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  manual: { icon: '👤', label: 'Manual', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

/* ─── Completion logic badges ─── */
const COMPLETION_BADGES: Record<string, { icon: string; label: string; color: string }> = {
  late: { icon: '🕐', label: 'Late OK', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  partial: { icon: '📊', label: 'Partial', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
};

/* ─── Streak rule display ─── */
const STREAK_ICONS: Record<string, { icon: string; color: string }> = {
  reset: { icon: '🔥', color: 'text-rose-400' },
  continue: { icon: '✅', color: 'text-emerald-400' },
  pause: { icon: '⏸️', color: 'text-amber-400' },
};

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

interface GoalsSectionProps {
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSaveGoal: (date: string, goal: Goal) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
  /* Focus integration */
  activeGoalIds: string[];
  getAccumulatedSeconds: (id: string) => number;
  /* Reminders */
  reminders: any[];
  onCreateReminder: (data: any) => void;
  onToggleReminder: (id: string, done: boolean) => void;
  onDeleteReminder: (id: string) => void;
  /* Schedule */
  schedule: any[];
  onAddSchedule: (entry: any) => void;
  onUpdateSchedule: (id: string, patch: any) => void;
  onDeleteSchedule: (id: string) => void;
  /* Deadline marks */
  radarMarks: Map<string, { color: string; label: string }[]>;
  /* Goals for schedule linking */
  linkedGoals?: { id: string; title: string }[];
}

export function GoalsSection({
  goals, longTermGoals, selectedDate, onSelectDate, onSaveGoal, onDeleteGoal,
  onRefresh, loading, error, activeGoalIds, getAccumulatedSeconds,
  reminders, onCreateReminder, onToggleReminder, onDeleteReminder,
  schedule, onAddSchedule, onUpdateSchedule, onDeleteSchedule, radarMarks,
  linkedGoals,
}: GoalsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCriteria, setEditCriteria] = useState<CriteriaForm | null>(null);
  const [newCriteria, setNewCriteria] = useState<CriteriaForm>(DEFAULT_CRITERIA);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showLangParser, setShowLangParser] = useState(false);

  const api = window.deskflowAPI;

  /* ─── Derived data ─── */
  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'done'), [goals]);
  const missedGoals = useMemo(() => getMissedGoals(goals, selectedDate), [goals, selectedDate]);
  const doneCount = completedGoals.length;
  const tracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const bestStreak = goals.reduce((mx, g) => Math.max(mx, g.streak || 0), 0);

  /* ─── Handlers ─── */
  const handleAdd = async () => {
    if (!newCriteria.title.trim()) return;
    const goal = criteriaToGoal(newCriteria, selectedDate);
    await onSaveGoal(selectedDate, goal);
    setIsAdding(false);
    setNewCriteria(DEFAULT_CRITERIA);
  };

  const handleToggle = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    await onSaveGoal(selectedDate, {
      ...goal, status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
  };

  const handleDelete = async (id: string) => {
    await onDeleteGoal(id);
  };

  const handleEditStart = (goal: Goal) => {
    setEditingId(goal.id);
    setEditCriteria(goalToCriteria(goal));
  };

  const handleEditSave = async () => {
    if (!editCriteria || !editingId) return;
    const goal = goals.find(g => g.id === editingId);
    if (!goal) return;
    const updated = { ...criteriaToGoal(editCriteria, goal.date, editingId), id: editingId };
    await onSaveGoal(goal.date, updated);
    setEditingId(null);
    setEditCriteria(null);
  };

  const handleLangAccept = async (parsed: any) => {
    const goal: Goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: parsed.title,
      category: parsed.category,
      period: parsed.period,
      target: {
        type: parsed.targetType,
        targetSeconds: parsed.targetSeconds || undefined,
      },
      status: 'active',
      date: selectedDate,
      source: 'ai',
      links: [],
      createdAt: new Date().toISOString(),
      trackingMode: parsed.trackingMode,
      completionLogic: parsed.completionLogic,
      cadenceConfig: parsed.cadenceConfig,
      crossFeatureLink: parsed.crossFeature || null,
    };
    await onSaveGoal(selectedDate, goal);
    setShowLangParser(false);
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const prettyDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (d === todayStr) return 'Today';
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-3">
      {/* ═══ HERO STATS ROW (Frontend Design §StatCard pattern) ═══ */}
      <div className="grid grid-cols-4 gap-2">
        <StatPill icon={<Target size={14} />} label="Active" value={activeGoals.length} color={ACCENT_VIOLET} />
        <StatPill icon={<CheckCircle2 size={14} />} label="Done" value={doneCount} color={ACCENT_EMERALD} />
        <StatPill icon={<Flame size={14} />} label="Best streak" value={bestStreak} color="text-amber-400" />
        <StatPill icon={<Clock size={14} />} label="Tracked" value={formatTime(tracked)} color={ACCENT_CYAN} />
      </div>

      {/* ═══ SCHEDULE — connected to goals ═══ */}
      <div className={`${GLASS} ${GLASS_HOVER}`}>
        <ScheduleCard
          entries={schedule}
          onAdd={onAddSchedule}
          onUpdate={onUpdateSchedule}
          onDelete={onDeleteSchedule}
        />
      </div>

      {/* ═══ DATE HEADER + ACTION BUTTONS (Human-Centric §Primary action obvious <1s) ═══ */}
      <div className="flex items-center justify-between">
        <h2 className={TYPE.sectionTitle}>{prettyDate(selectedDate)}</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowLangParser(!showLangParser)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150 ${
              showLangParser
                ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
            }`}
            title="Create goal with natural language"
          >
            <Wand2 size={12} /> AI
          </button>
          <button
            onClick={() => { setIsAdding(!isAdding); setNewCriteria(DEFAULT_CRITERIA); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-150 ${
              isAdding
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            {isAdding ? <X size={13} /> : <Plus size={13} />}
            {isAdding ? 'Cancel' : 'Add Goal'}
          </button>
        </div>
      </div>

      {/* ═══ AI LANGUAGE PARSER (Progressive Disclosure — hidden until clicked) ═══ */}
      <AnimatePresence>
        {showLangParser && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`${GLASS} p-4`}>
              <GoalLanguageParser onAccept={handleLangAccept} onCancel={() => setShowLangParser(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ADD GOAL FORM (Progressive Disclosure) ═══ */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`${GLASS} p-4`}>
              <CriteriaBuilder
                value={newCriteria} onChange={setNewCriteria} onSave={handleAdd}
                onCancel={() => setIsAdding(false)}
                longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MISSED GOALS RECOVERY ═══ */}
      <MissedGoalRecoveryBanner
        missedGoals={missedGoals}
        onRecover={async (goalId, action) => {
          const goal = goals.find(g => g.id === goalId);
          if (!goal) return;
          if (action === 'mark_late') {
            await onSaveGoal(selectedDate, { ...goal, status: 'done', completedAt: new Date().toISOString() });
          } else if (action === 'reschedule') {
            await onSaveGoal(selectedDate, { ...goal, date: selectedDate });
          } else {
            await onDeleteGoal(goalId);
          }
        }}
        onDismiss={() => {}}
      />

      {/* ═══ GOAL LIST — IMMEDIATELY after actions (Human-Centric §Clarity) ═══ */}
      {loading ? (
        <GoalCardSkeleton />
      ) : error ? (
        <GoalErrorState message={error} onRetry={onRefresh} />
      ) : activeGoals.length === 0 && !isAdding ? (
        <div className={`${GLASS} p-8`}>
          <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(DEFAULT_CRITERIA); }} />
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeGoals.map(goal => (
            <div key={goal.id} className="relative">
              {editingId === goal.id ? (
                <div className={`${GLASS} p-4`}>
                  <CriteriaBuilder
                    value={editCriteria!} onChange={setEditCriteria!} onSave={handleEditSave}
                    onCancel={() => { setEditingId(null); setEditCriteria(null); }}
                    longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                    isEditing
                  />
                </div>
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
      )}

      {/* ═══ COMPLETED GOALS ═══ */}
      {completedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(p => !p)}
            className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showCompleted ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Sealed ({completedGoals.length})
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1.5 mt-2">
                {completedGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} onToggle={handleToggle} onDelete={handleDelete}
                    onEdit={handleEditStart}
                    longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ HABIT TRACKER ═══ */}
      <div className={`${GLASS} ${GLASS_HOVER} p-4`}>
        <HabitTracker currentDate={selectedDate} />
      </div>

      {/* ═══ AI GOAL COACH ═══ */}
      <div className={`${GLASS} ${GLASS_HOVER} p-4`}>
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles size={13} className={ACCENT_VIOLET} />
          <span className={TYPE.sectionTitle}>AI Goal Coach</span>
        </div>
        <GoalAICoach
          onApply={async (proposal) => {
            if (!api) return;
            await api.goalAiApplyProposal(proposal.goalId, proposal.newConfig || {});
            onRefresh();
          }}
          onDismiss={() => {}}
        />
      </div>
    </div>
  );
}

/* ═══════════════════ SUB-COMPONENTS ═══════════════════ */

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`${GLASS} px-3 py-2.5 flex items-center gap-2`}>
      <span className={color}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-zinc-100 tabular-nums">{value}</div>
        <div className={TYPE.small}>{label}</div>
      </div>
    </div>
  );
}

/* ═══════════════════ FORM HELPERS ═══════════════════ */

const DEFAULT_CRITERIA: CriteriaForm = {
  title: '', description: '', category: 'work', period: 'daily',
  targetType: 'completion', targetHours: 0, targetMinutes: 30,
  externalHours: 0, externalMinutes: 30,
  matchCategory: '', detectionEnabled: false, detectionMode: 'positive',
  detectionKeywords: '', detectionMinMinutes: 10,
  parentIds: [], links: [],
  externalActivityId: null,
  trackingMode: 'manual',
  completionLogic: DEFAULT_COMPLETION_LOGIC,
  cadenceConfig: DEFAULT_CADENCE_CONFIG,
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
    trackingMode: g.trackingMode || 'manual',
    completionLogic: g.completionLogic || DEFAULT_COMPLETION_LOGIC,
    cadenceConfig: g.cadenceConfig || DEFAULT_CADENCE_CONFIG,
    crossFeatureLink: g.crossFeatureLink ?? null,
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
      maxExternalSeconds: c.targetType === 'external' ? c.externalHours * 3600 + c.externalMinutes * 60 : undefined,
      matchCategory: c.matchCategory || undefined,
    },
    period: c.period, status: 'active', date, source: 'manual',
    links: c.links, progressSeconds: 0, createdAt: new Date().toISOString(),
    parentId: c.parentIds[0] || undefined,
    parentIds: c.parentIds.length ? c.parentIds : undefined,
    detection: c.detectionEnabled ? {
      enabled: true, mode: c.detectionMode,
      keywords: c.detectionKeywords.split(',').map(k => k.trim()).filter(Boolean),
      minMinutes: c.detectionMinMinutes,
    } : undefined,
    externalActivityId: c.externalActivityId ?? null,
    trackingMode: c.trackingMode,
    completionLogic: c.completionLogic,
    cadenceConfig: c.cadenceConfig,
    crossFeatureLink: c.crossFeatureLink ?? null,
  };
}

```

---

### FILE: src\components\goals\GoalCard.tsx (273 lines)

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Edit3, Trash2, RefreshCw, Flame, Clock, Target,
  Monitor, AlertCircle, Zap, ArrowRight
} from 'lucide-react';
import { confetti } from '../ui/confetti';
import type { Goal as GoalType } from '../dashboard/types';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  work: { label: 'Work', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  personal: { label: 'Personal', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  health: { label: 'Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  learning: { label: 'Learning', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  finance: { label: 'Finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  relationships: { label: 'Relationships', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

interface GoalCardProps {
  goal: GoalType;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (goal: GoalType) => void;
  longTermGoals?: { id: string; title: string }[];
}

export function GoalCard({ goal, onToggle, onDelete, onEdit, longTermGoals = [] }: GoalCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleToggle = () => {
    if (goal.status !== 'done') {
      confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24'] });
    }
    onToggle(goal.id);
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      onDelete(goal.id);
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(prev => prev ? false : prev), 3000);
    }
  };

  const catMeta = CATEGORY_STYLES[goal.category] || CATEGORY_STYLES.work;
  const isTime = goal.target.type === 'time';
  const isExternal = goal.target.type === 'external';
  const progress = isTime && goal.target.targetSeconds
    ? Math.min(100, ((goal.progressSeconds || 0) / goal.target.targetSeconds) * 100)
    : isExternal && goal.target.maxExternalSeconds
      ? Math.min(100, Math.max(0, 100 - ((goal.progressSeconds || 0) / goal.target.maxExternalSeconds) * 100))
      : goal.target.done ? 100 : 0;

  const parentIds = goal.parentIds?.length ? goal.parentIds : (goal.parentId ? [goal.parentId] : []);
  const parentGoals = parentIds
    .map(id => longTermGoals.find(l => l.id === id))
    .filter((p): p is { id: string; title: string } => !!p);

  return (
    <div className="group relative p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] hover:border-zinc-700/50 transition-all duration-200">
      <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-violet-500/20 via-violet-500/5 to-transparent" />

      <div className="flex items-start gap-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleToggle}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-200 ${
            goal.status === 'done'
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-zinc-600 hover:border-violet-400/50'
          }`}
          aria-label={goal.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
        >
          {goal.status === 'done' && <Check size={12} className="text-white" strokeWidth={3} />}
        </motion.button>

        <div className="flex-1 min-w-0">
          <div className={`text-[13px] truncate transition-colors ${
            goal.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'
          }`}>{goal.title}</div>

          {goal.description && (
            <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">{goal.description}</p>
          )}

          {parentGoals.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <ArrowRight size={8} className="text-zinc-600 shrink-0" />
              {parentGoals.map(p => (
                <span key={p.id} className="text-[10px] text-zinc-500 truncate">Serves: {p.title}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catMeta.color}`}>
              {catMeta.label}
            </span>
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <RefreshCw size={8} />{goal.period}
            </span>
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Target size={8} />{goal.target.type}
            </span>

            {isTime && goal.target.targetSeconds && (
              <span className="text-[10px] text-zinc-600">
                {formatTime(goal.progressSeconds || 0)} / {formatTime(goal.target.targetSeconds)}
              </span>
            )}

            {isExternal && goal.target.maxExternalSeconds && (
              <span className={`text-[10px] ${(goal.progressSeconds || 0) > goal.target.maxExternalSeconds ? 'text-amber-400' : 'text-zinc-600'}`}>
                {formatTime(goal.progressSeconds || 0)} / {formatTime(goal.target.maxExternalSeconds)} max
              </span>
            )}

            {goal.detection?.enabled && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                goal.detection.mode === 'avoidance'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <Monitor size={8} className="inline mr-0.5" />
                auto
              </span>
            )}

            {goal.streak && goal.streak > 1 && (
              <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5">
                <Flame size={8} />{goal.streak}
              </span>
            )}

            {goal.trackingMode && goal.trackingMode !== 'manual' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                goal.trackingMode === 'system'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                {goal.trackingMode === 'system' ? '⚙️ system' : '🔄 hybrid'}
              </span>
            )}

            {goal.completionLogic?.lateAllowed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                <Clock size={8} className="inline mr-0.5" />late OK
              </span>
            )}

            {goal.status === 'missed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
                missed
              </span>
            )}
          </div>

          {isTime && goal.target.targetSeconds && (
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          )}

          {goal.detection?.enabled && goal.detection.keywords.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-zinc-600">Detect:</span>
              {goal.detection.keywords.map((kw, i) => (
                <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {goal.status === 'done' && goal.completedAt && (
            <div className="mt-1 text-[10px] text-emerald-600/80 flex items-center gap-1">
              <Check size={8} /> Completed {new Date(goal.completedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit(goal)}
            className="w-7 h-7 rounded-md bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-white flex items-center justify-center transition-colors"
            title="Edit goal"
          >
            <Edit3 size={12} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              deleteConfirm
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
            }`}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete goal'}
          >
            <Trash2 size={12} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-zinc-800/30 rounded-xl" />
      ))}
    </div>
  );
}

export function GoalEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
        <Target size={24} className="text-zinc-600" />
      </div>
      <p className="text-[14px] font-medium text-zinc-400">No goals for this day</p>
      <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">
        Add a goal or check another day on the calendar
      </p>
      <button
        onClick={onAdd}
        className="mt-3 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-[12px] font-medium"
      >
        Add Goal
      </button>
    </div>
  );
}

export function GoalErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
        <AlertCircle size={24} className="text-zinc-600" />
      </div>
      <p className="text-[14px] font-medium text-zinc-400">Could not load goals</p>
      <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/50 hover:text-white transition-colors text-[12px] font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}

```

---

### FILE: src\components\goals\CriteriaBuilder.tsx (511 lines)

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Clock, CheckCircle2, Monitor, Search, Target, ArrowDownToLine, CalendarDays, AlertTriangle, Settings2, Zap } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectItem } from '../ui/select';
import { FocusGroupSelect } from './FocusGroupSelect';
import { ExternalActivityPicker } from './ExternalActivityPicker';
import { CrossFeatureLinkPicker } from './CrossFeatureLinkPicker';
import type { GoalCategory, GoalTarget, GoalPeriod, TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink } from '../../types/goals';
import { DEFAULT_COMPLETION_LOGIC, DEFAULT_CADENCE_CONFIG } from '../../types/goals';

export interface CriteriaForm {
  title: string;
  description: string;
  category: GoalCategory;
  period: GoalPeriod;
  targetType: GoalTarget['type'];
  targetHours: number;
  targetMinutes: number;
  externalHours: number;
  externalMinutes: number;
  matchCategory: string;
  detectionEnabled: boolean;
  detectionMode: 'positive' | 'avoidance';
  detectionKeywords: string;
  detectionMinMinutes: number;
  parentIds: string[];
  links: { label: string; url: string }[];
  externalActivityId?: number | null;
  trackingMode: TrackingMode;
  completionLogic: CompletionLogic;
  cadenceConfig: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
}

interface CriteriaBuilderProps {
  value: CriteriaForm;
  onChange: (form: CriteriaForm) => void;
  onSave: () => void;
  onCancel: () => void;
  longTermGoals: { id: string; title: string }[];
  isEditing?: boolean;
}

const CATEGORIES: { value: GoalCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: 'text-pink-400' },
  { value: 'personal', label: 'Personal', color: 'text-violet-400' },
  { value: 'health', label: 'Health', color: 'text-emerald-400' },
  { value: 'learning', label: 'Learning', color: 'text-cyan-400' },
  { value: 'finance', label: 'Finance', color: 'text-amber-400' },
  { value: 'relationships', label: 'Relationships', color: 'text-rose-400' },
];

export function LTGPicker({
  longTermGoals, value, onChange,
}: {
  longTermGoals: { id: string; title: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-zinc-500 block">
        Link to long-term goals {value.length > 0 && <span className="text-violet-400">({value.length} selected)</span>}
      </label>
      <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
        {longTermGoals.map(ltg => {
          const selected = value.includes(ltg.id);
          return (
            <button
              type="button"
              key={ltg.id}
              onClick={() => toggle(ltg.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                selected
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                selected ? 'bg-violet-500 border-violet-500' : 'border-zinc-600'
              }`}>
                {selected && <CheckCircle2 size={9} className="text-white" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] truncate">{ltg.title}</span>
              </span>
              <Target size={11} className={`shrink-0 ${selected ? 'text-violet-400' : 'text-zinc-600'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CriteriaBuilder({ value, onChange, onSave, onCancel, longTermGoals, isEditing }: CriteriaBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<CriteriaForm>) => onChange({ ...value, ...patch });

  const targetSeconds = value.targetType === 'time'
    ? (value.targetHours * 3600) + (value.targetMinutes * 60)
    : undefined;

  return (
    <div className="space-y-3">
      <Input
        value={value.title}
        onChange={e => update({ title: e.target.value })}
        onKeyDown={e => e.key === 'Enter' && value.title.trim() && onSave()}
        placeholder="What do you want to achieve?"
        autoFocus
        className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-9"
      />

      <Input
        value={value.description}
        onChange={e => update({ description: e.target.value })}
        placeholder="Add details (optional)"
        className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-9"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={value.category} onValueChange={v => update({ category: v as GoalCategory })} className="w-[110px]">
          {CATEGORIES.map(c => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </Select>

        <Select value={value.period} onValueChange={v => update({ period: v as GoalPeriod })} className="w-[100px]">
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={value.targetType} onValueChange={v => update({ targetType: v as GoalTarget['type'] })} className="w-[180px]">
          <SelectItem value="completion">Complete it</SelectItem>
          <SelectItem value="time">Spend time</SelectItem>
          <SelectItem value="external">External usage under</SelectItem>
        </Select>

        {value.targetType === 'time' && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5"
          >
            <Clock size={13} className="text-zinc-500" />
            <Input
              type="number" min={0} max={23}
              value={value.targetHours}
              onChange={e => update({ targetHours: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">h</span>
            <Input
              type="number" min={0} max={59}
              value={value.targetMinutes}
              onChange={e => update({ targetMinutes: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">m</span>
            {targetSeconds && (
              <span className="text-[10px] text-zinc-600 ml-1">
                = {Math.floor(targetSeconds / 3600)}h {Math.floor((targetSeconds % 3600) / 60)}m
              </span>
            )}
          </motion.div>
        )}
      </div>

      {value.targetType === 'time' && (
        <div>
          <FocusGroupSelect
            label="Track time spent in focus group"
            value={value.matchCategory || ''}
            onValueChange={v => update({ matchCategory: v })}
            className="w-full"
          />
          <p className="text-[10px] text-zinc-600 mt-1">Progress counts completed focus sessions of the group.</p>
        </div>
      )}

      {value.targetType === 'external' && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <ArrowDownToLine size={13} className="text-amber-400" />
            Keep this external activity under:
          </div>
          <ExternalActivityPicker value={value.externalActivityId ?? null} onChange={id => update({ externalActivityId: id, matchCategory: id == null ? '' : String(id) })} />
          <div className="flex items-center gap-1.5">
            <Input
              type="number" min={0} max={23}
              value={value.externalHours}
              onChange={e => update({ externalHours: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">h</span>
            <Input
              type="number" min={0} max={59}
              value={value.externalMinutes}
              onChange={e => update({ externalMinutes: parseInt(e.target.value) || 0 })}
              className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8 text-center"
            />
            <span className="text-[11px] text-zinc-500">m</span>
            <span className="text-[10px] text-zinc-600 ml-1">
              max per day
            </span>
          </div>
          <p className="text-[10px] text-zinc-600">Goal completes when external/distracting app usage stays below this limit for the day.</p>
        </motion.div>
      )}

      {longTermGoals.length > 0 && (
        <LTGPicker
          longTermGoals={longTermGoals}
          value={value.parentIds}
          onChange={ids => update({ parentIds: ids })}
        />
      )}

      {/* Tracking Mode */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-zinc-500 flex items-center gap-1">
          <Settings2 size={11} /> Tracking mode
        </label>
        <div className="flex gap-2">
          {(['manual', 'system', 'hybrid'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => update({ trackingMode: mode })}
              className={`flex-1 px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                value.trackingMode === mode
                  ? mode === 'system'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : mode === 'hybrid'
                      ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                      : 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                  : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
              }`}
            >
              {mode === 'manual' && '👤 Manual'}
              {mode === 'system' && '⚙️ System'}
              {mode === 'hybrid' && '🔄 Hybrid'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600">
          {value.trackingMode === 'manual' && 'You check off completion yourself.'}
          {value.trackingMode === 'system' && 'Progress auto-tracks from app data.'}
          {value.trackingMode === 'hybrid' && 'Auto-tracks when possible, manual override available.'}
        </p>
      </div>

      {/* Completion Logic */}
      <div className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <AlertTriangle size={13} className="text-amber-400" />
          What happens if this goal is missed?
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.completionLogic.lateAllowed}
            onChange={e => update({ completionLogic: { ...value.completionLogic, lateAllowed: e.target.checked } })}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
          />
          Allow late completion
        </label>
        {value.completionLogic.lateAllowed && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            Grace period:
            <Input
              type="number" min={0} max={1440}
              value={value.completionLogic.gracePeriodMinutes}
              onChange={e => update({ completionLogic: { ...value.completionLogic, gracePeriodMinutes: parseInt(e.target.value) || 0 } })}
              className="w-20 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
            />
            minutes after deadline
          </div>
        )}
        <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.completionLogic.partialCredit}
            onChange={e => update({ completionLogic: { ...value.completionLogic, partialCredit: e.target.checked } })}
            className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
          />
          Partial credit (e.g. 70% of target = 70% complete)
        </label>
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-500">When missed, streak should:</label>
          <div className="flex gap-2">
            {(['reset', 'continue', 'pause'] as const).map(rule => (
              <button
                key={rule}
                type="button"
                onClick={() => update({ completionLogic: { ...value.completionLogic, streakOnMiss: rule } })}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                  value.completionLogic.streakOnMiss === rule
                    ? rule === 'reset'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : rule === 'continue'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50'
                }`}
              >
                {rule === 'reset' && '🔥 Reset'}
                {rule === 'continue' && '✅ Continue'}
                {rule === 'pause' && '⏸️ Pause'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cadence Config */}
      {(value.period === 'weekly' || value.period === 'monthly') && (
        <div className="space-y-2 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <CalendarDays size={13} className="text-cyan-400" />
            Schedule pattern
          </div>
          <div className="flex gap-2">
            {(['fixed', 'rolling', 'flexible'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => update({ cadenceConfig: { ...value.cadenceConfig, type } })}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                  value.cadenceConfig.type === type
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                    : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                {type === 'fixed' && '📌 Fixed days'}
                {type === 'rolling' && '🔄 Rolling target'}
                {type === 'flexible' && '🎯 Flexible window'}
              </button>
            ))}
          </div>
          {value.cadenceConfig.type === 'fixed' && (
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500">Select days:</label>
              <div className="flex gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const days = value.cadenceConfig.fixedDays.includes(i)
                        ? value.cadenceConfig.fixedDays.filter(d => d !== i)
                        : [...value.cadenceConfig.fixedDays, i];
                      update({ cadenceConfig: { ...value.cadenceConfig, fixedDays: days } });
                    }}
                    className={`w-9 h-7 rounded-md text-[10px] font-medium border transition-colors ${
                      value.cadenceConfig.fixedDays.includes(i)
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50 hover:border-zinc-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}
          {value.cadenceConfig.type === 'rolling' && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              Complete
              <Input
                type="number" min={1} max={31}
                value={value.cadenceConfig.rollingTarget}
                onChange={e => update({ cadenceConfig: { ...value.cadenceConfig, rollingTarget: parseInt(e.target.value) || 1 } })}
                className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
              />
              times per {value.period}
            </div>
          )}
          {value.cadenceConfig.type === 'flexible' && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              Any
              <Input
                type="number" min={1} max={31}
                value={value.cadenceConfig.flexibleWindowDays}
                onChange={e => update({ cadenceConfig: { ...value.cadenceConfig, flexibleWindowDays: parseInt(e.target.value) || 1 } })}
                className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
              />
              of {value.period === 'weekly' ? '7 days' : '30 days'}
            </div>
          )}
        </div>
      )}

      {/* Cross-Feature Link */}
      <CrossFeatureLinkPicker
        value={value.crossFeatureLink ?? null}
        onChange={link => update({ crossFeatureLink: link })}
      />

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
      >
        {showAdvanced ? '−' : '+'} Advanced: Detection & Criteria
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/40"
          >
            <div className="flex items-center gap-2">
              <Monitor size={13} className="text-zinc-500" />
              <label className="flex items-center gap-2 text-[12px] text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.detectionEnabled}
                  onChange={e => update({ detectionEnabled: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
                />
                Auto-detect completion from app usage
              </label>
            </div>

            {value.detectionEnabled && (
              <>
                <div className="flex gap-2">
                  {(['positive', 'avoidance'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => update({ detectionMode: m })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        value.detectionMode === m
                          ? m === 'positive'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-zinc-900/60 text-zinc-500 border-zinc-700/50'
                      }`}
                    >
                      {m === 'positive' ? 'Positive (accumulate)' : 'Avoidance (flag)'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">
                    <Search size={11} className="inline mr-1" />
                    App/window title keywords (comma-separated):
                  </label>
                  <Input
                    value={value.detectionKeywords}
                    onChange={e => update({ detectionKeywords: e.target.value })}
                    placeholder="e.g. VS Code, Duolingo, Figma"
                    className="bg-zinc-900/80 border-zinc-700/50 text-[13px] h-8"
                  />
                </div>

                {value.detectionMode === 'positive' && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    Mark complete after
                    <Input
                      type="number" min={1}
                      value={value.detectionMinMinutes}
                      onChange={e => update({ detectionMinMinutes: parseInt(e.target.value) || 1 })}
                      className="w-14 bg-zinc-900/80 border-zinc-700/50 text-[13px] h-7 text-center"
                    />
                    minutes detected
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!value.title.trim()}
          className="px-4 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-medium transition-colors"
        >
          <CheckCircle2 size={12} className="inline mr-1" />
          {isEditing ? 'Save Changes' : 'Add Goal'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 text-[12px] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

```

---

### FILE: src\components\goals\MissedGoalRecoveryBanner.tsx (88 lines)

```tsx
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
                <div key={goal.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
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

```

---

### FILE: src\components\goals\GoalCompletionEngine.ts (65 lines)

```tsx
import type { Goal, CompletionLogic } from '../../types/goals';

export interface CompletionEvaluation {
  isCompleted: boolean;
  isLate: boolean;
  isMissed: boolean;
  percentComplete: number;
  streakImpact: 'none' | 'reset' | 'continue' | 'pause';
}

export function evaluateGoal(goal: Goal, now: Date = new Date()): CompletionEvaluation {
  const logic: CompletionLogic = goal.completionLogic || { lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, streakOnMiss: 'reset' };

  if (goal.status === 'done') {
    return { isCompleted: true, isLate: false, isMissed: false, percentComplete: 100, streakImpact: 'none' };
  }

  const goalDate = new Date(goal.date + 'T23:59:59');
  const deadline = new Date(goalDate.getTime() + logic.gracePeriodMinutes * 60 * 1000);
  const isPastDeadline = now > deadline;

  let percentComplete = 0;
  if (goal.target?.type === 'time' && goal.target?.targetSeconds) {
    percentComplete = Math.min(100, Math.round(((goal.progressSeconds || 0) / goal.target.targetSeconds) * 100));
  } else if (goal.target?.type === 'external' && goal.target?.maxExternalSeconds) {
    percentComplete = Math.min(100, Math.max(0, 100 - (((goal.progressSeconds || 0) / goal.target.maxExternalSeconds) * 100)));
  } else if (goal.target?.done) {
    percentComplete = 100;
  }

  const isCompleted = percentComplete >= 100 || goal.status === 'done';
  const isLate = isCompleted && isPastDeadline;
  const isMissed = !isCompleted && isPastDeadline;

  let streakImpact: CompletionEvaluation['streakImpact'] = 'none';
  if (isMissed) {
    streakImpact = logic.streakOnMiss;
  }

  return { isCompleted, isLate, isMissed, percentComplete, streakImpact };
}

export function getMissedGoals(goals: Goal[], today: string): Goal[] {
  return goals.filter(g => {
    if (g.status === 'done' || g.status === 'archived') return false;
    return g.date < today;
  });
}

export function formatGracePeriod(minutes: number): string {
  if (minutes === 0) return 'No grace period';
  if (minutes < 60) return `${minutes}m grace`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m grace` : `${h}h grace`;
}

export function formatStreakRule(rule: string): string {
  const map: Record<string, string> = {
    reset: '🔥 Streak resets on miss',
    continue: '✅ Streak continues on miss',
    pause: '⏸️ Streak pauses on miss',
  };
  return map[rule] || rule;
}

```

---

### FILE: src\components\goals\HabitTracker.tsx (186 lines)

```tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';

interface Habit {
  id: string;
  title: string;
  category: string;
  period: string;
  date: string;
  status: string;
  cadenceConfig?: { type: string; fixedDays: number[]; rollingTarget: number; flexibleWindowDays: number };
}

interface HabitDay {
  date: string;
  completed: boolean;
}

interface HabitWithProgress extends Habit {
  weekProgress: HabitDay[];
}

interface HabitTrackerProps {
  currentDate: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  personal: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  health: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  learning: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  finance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  relationships: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function getWeekDays(currentDate: string): string[] {
  const d = new Date(currentDate + 'T12:00:00');
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(start);
    dd.setDate(dd.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  });
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function HabitTracker({ currentDate }: HabitTrackerProps) {
  const [habits, setHabits] = useState<HabitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekDays = getWeekDays(currentDate);

  useEffect(() => {
    console.log('%c[HabitTracker] v1.0 loaded', 'color: #fbbf24; font-weight: bold');
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = (window as any).deskflowAPI;
        const start = weekDays[0];
        const end = weekDays[6];
        const result = await api?.getHabits?.(start, end);
        if (mounted && result?.habits) {
          const habitsWithProgress: HabitWithProgress[] = result.habits.map((h: Habit) => ({
            ...h,
            weekProgress: weekDays.map(d => ({ date: d, completed: h.date === d && h.status === 'done' })),
          }));
          setHabits(habitsWithProgress);
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Could not load habits');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [currentDate]);

  const toggleDay = async (habitId: string, date: string, currentStatus: boolean) => {
    try {
      const api = (window as any).deskflowAPI;
      await api?.toggleHabitDay?.(habitId, date, !currentStatus);
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h;
        return {
          ...h,
          weekProgress: h.weekProgress.map(d =>
            d.date === date ? { ...d, completed: !currentStatus } : d
          ),
        };
      }));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500"><LoaderCircle size={13} className="animate-spin" /> Loading habits...</div>
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-zinc-800/30 animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[11px] text-rose-300">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 inline-flex items-center gap-1.5 text-rose-200 hover:text-white">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="p-6 text-center">
        <Target size={24} className="mx-auto mb-2 text-zinc-600" />
        <p className="text-[13px] text-zinc-400">No habits yet</p>
        <p className="text-[11px] text-zinc-600 mt-1">Create one with "habit" target type in the goal form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
        <Flame size={13} className="text-amber-400" /> Weekly habit grid
      </div>

      {/* Day headers */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `1fr repeat(7, 36px)` }}>
        <div />
        {weekDays.map(d => (
          <div key={d} className={`text-center text-[10px] font-medium ${d === currentDate ? 'text-amber-400' : 'text-zinc-500'}`}>
            {formatDayLabel(d)}
          </div>
        ))}
      </div>

      {/* Habit rows */}
      {habits.map(habit => {
        const completedCount = habit.weekProgress.filter(d => d.completed).length;
        const colorClass = CATEGORY_COLORS[habit.category] || CATEGORY_COLORS.work;
        return (
          <div key={habit.id} className="grid gap-1 items-center" style={{ gridTemplateColumns: `1fr repeat(7, 36px)` }}>
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-[12px] text-zinc-300 truncate">{habit.title}</span>
              {completedCount > 0 && (
                <span className="text-[9px] text-amber-400/80 shrink-0 flex items-center gap-0.5">
                  <Flame size={8} />{completedCount}
                </span>
              )}
            </div>
            {habit.weekProgress.map(day => (
              <motion.button
                key={day.date}
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleDay(habit.id, day.date, day.completed)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  day.completed
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : day.date === currentDate
                      ? 'bg-zinc-800/60 border-zinc-600/50 text-zinc-400 hover:border-zinc-500'
                      : 'bg-zinc-900/30 border-zinc-800/40 text-zinc-600 hover:border-zinc-700'
                }`}
              >
                {day.completed && <CheckCircle2 size={14} />}
              </motion.button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

```

---

### FILE: src\components\goals\GoalAICoach.tsx (144 lines)

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, X, LoaderCircle, ArrowRight, Zap } from 'lucide-react';

interface Proposal {
  goalId: string;
  action: 'reschedule' | 'adjust_target' | 'split' | 'retire' | 'celebrate';
  reason: string;
  newConfig?: any;
}

interface GoalAICoachProps {
  onApply: (proposal: Proposal) => void;
  onDismiss: (proposal: Proposal) => void;
}

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  reschedule: { label: '📅 Reschedule', color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  adjust_target: { label: '🎯 Adjust Target', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
  split: { label: '✂️ Split Goal', color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/20' },
  retire: { label: '🗑️ Retire', color: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/20' },
  celebrate: { label: '🎉 Celebrate', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

export function GoalAICoach({ onApply, onDismiss }: GoalAICoachProps) {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  const runMonitor = async () => {
    setLoading(true);
    setError(null);
    setProposals(null);
    try {
      const api = (window as any).deskflowAPI;
      const result = await api?.goalAiMonitor?.();
      if (result?.success) {
        setProposals(result.proposals || []);
      } else {
        setError(result?.error || 'AI monitor failed');
      }
    } catch (err: any) {
      setError(err?.message || 'AI monitor failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (idx: number, proposal: Proposal) => {
    setApplied(prev => new Set(prev).add(idx));
    onApply(proposal);
  };

  return (
    <div className="space-y-3">
      {proposals === null && !loading && (
        <button
          type="button"
          onClick={runMonitor}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-500/20 bg-violet-500/5 text-[12px] text-violet-300 hover:bg-violet-500/10 transition-colors"
        >
          <Sparkles size={14} /> AI Health Check
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 p-6 text-[11px] text-zinc-500">
          <LoaderCircle size={14} className="animate-spin" /> Analyzing your goals...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[11px] text-rose-300">
          <p>{error}</p>
          <button type="button" onClick={runMonitor} className="mt-2 text-rose-200 hover:text-white">Retry</button>
        </div>
      )}

      {proposals !== null && !loading && (
        <AnimatePresence>
          {proposals.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-[12px] text-emerald-300">All goals look healthy!</p>
              <p className="text-[10px] text-zinc-500 mt-1">Check back in 24 hours.</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {proposals.map((p, idx) => {
                const style = ACTION_STYLES[p.action] || ACTION_STYLES.reschedule;
                const isApplied = applied.has(idx);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-3 rounded-xl border ${style.bg} ${isApplied ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`text-[11px] font-medium ${style.color} shrink-0`}>{style.label}</span>
                      <p className="text-[11px] text-zinc-300 flex-1">{p.reason}</p>
                    </div>
                    {!isApplied && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleApply(idx, p)}
                          className="px-3 py-1 rounded-lg text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismiss(p)}
                          className="px-3 py-1 rounded-lg text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {isApplied && (
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Applied
                      </p>
                    )}
                  </motion.div>
                );
              })}
              <button
                type="button"
                onClick={() => { setProposals(null); }}
                className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
              >
                Run again
              </button>
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

```

---

### FILE: src\components\goals\GoalLanguageParser.tsx (141 lines)

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LoaderCircle, Wand2, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { Input } from '../ui/input';
import type { GoalCategory, TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink } from '../../types/goals';
import { DEFAULT_COMPLETION_LOGIC, DEFAULT_CADENCE_CONFIG } from '../../types/goals';

interface ParsedGoal {
  title: string;
  category: GoalCategory;
  period: 'daily' | 'weekly' | 'monthly';
  targetType: 'time' | 'completion' | 'external' | 'habit' | 'cross_feature';
  targetSeconds: number | null;
  externalActivityName: string | null;
  crossFeature: { feature: string; entityName: string } | null;
  cadenceConfig: CadenceConfig;
  trackingMode: TrackingMode;
  completionLogic: CompletionLogic;
}

interface GoalLanguageParserProps {
  onAccept: (parsed: ParsedGoal) => void;
  onCancel: () => void;
}

export function GoalLanguageParser({ onAccept, onCancel }: GoalLanguageParserProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedGoal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const api = (window as any).deskflowAPI;
      const result = await api?.goalAiParseLanguage?.(text.trim());
      if (result?.success && result.parsedGoal) {
        setParsed({
          title: result.parsedGoal.title || text.trim(),
          category: result.parsedGoal.category || 'work',
          period: result.parsedGoal.period || 'daily',
          targetType: result.parsedGoal.targetType || 'completion',
          targetSeconds: result.parsedGoal.targetSeconds || null,
          externalActivityName: result.parsedGoal.externalActivityName || null,
          crossFeature: result.parsedGoal.crossFeature || null,
          cadenceConfig: result.parsedGoal.cadenceConfig || DEFAULT_CADENCE_CONFIG,
          trackingMode: result.parsedGoal.trackingMode || 'manual',
          completionLogic: result.parsedGoal.completionLogic || DEFAULT_COMPLETION_LOGIC,
        });
      } else {
        setError(result?.error || 'Failed to parse goal');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to parse goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
        <Wand2 size={14} className="text-violet-400" />
        Describe your goal in plain language
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Practice guitar 3x a week for 20 minutes, but I travel so any 3 days is fine. Allow late completion with 1 day grace period."
        className="w-full h-20 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-700/50 text-[12px] text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500/50"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); parse(); } }}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={parse}
          disabled={!text.trim() || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-[11px] font-medium transition-colors"
        >
          {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Parsing...' : 'Parse with AI'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <AnimatePresence>
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 size={12} /> Parsed goal:
            </div>
            <div className="text-[12px] text-zinc-200 font-medium">{parsed.title}</div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">{parsed.category}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{parsed.period}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{parsed.targetType}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{parsed.trackingMode}</span>
              {parsed.cadenceConfig.type !== 'fixed' && (
                <span className="px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                  {parsed.cadenceConfig.type}: {parsed.cadenceConfig.type === 'rolling' ? `${parsed.cadenceConfig.rollingTarget}x` : `any ${parsed.cadenceConfig.flexibleWindowDays}`}
                </span>
              )}
              {parsed.completionLogic.lateAllowed && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  late OK ({parsed.completionLogic.gracePeriodMinutes}m)
                </span>
              )}
              {parsed.completionLogic.partialCredit && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  partial credit
                </span>
              )}
            </div>
            <button
              onClick={() => onAccept(parsed)}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-medium transition-colors"
            >
              Use this goal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

---

### FILE: src\components\goals\CalendarStrip.tsx (100 lines)

```tsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

function getDaysAround(center: Date, range: number): { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] {
  const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = -range; i <= range; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    days.push({
      dateStr,
      dayName: names[d.getDay()],
      dayNum: d.getDate(),
      isToday: isToday(dateStr),
    });
  }
  return days;
}

interface CalendarStripProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  goalDates?: Set<string>;
}

const DAY_RANGE = 14;

export function CalendarStrip({ selectedDate, onDateChange, goalDates }: CalendarStripProps) {
  const centerDate = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
  const days = useMemo(() => getDaysAround(centerDate, DAY_RANGE), [centerDate]);

  const shiftWeek = (delta: number) => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + delta * 7);
    onDateChange(formatDate(d));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => shiftWeek(-1)}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors shrink-0"
        aria-label="Previous week"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 flex gap-1 overflow-x-auto">
        {days.map(({ dateStr, dayName, dayNum, isToday: today }) => {
          const selected = dateStr === selectedDate;
          const hasGoals = goalDates?.has(dateStr);
          return (
            <motion.button
              key={dateStr}
              onClick={() => onDateChange(dateStr)}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center gap-0.5 py-2 px-2.5 rounded-xl min-w-[48px] transition-all duration-200 relative ${
                selected
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                  : today
                    ? 'bg-zinc-800/40 text-zinc-300 border border-zinc-700/30'
                    : 'bg-zinc-900/40 text-zinc-500 border border-transparent hover:bg-zinc-800/30 hover:text-zinc-300'
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">{dayName}</span>
              <span className={`text-[15px] font-semibold tabular-nums ${selected ? 'text-white' : ''}`}>{dayNum}</span>
              {hasGoals && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${selected ? 'bg-violet-400' : 'bg-emerald-400/60'}`} />
              )}
              {today && !selected && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400" />
              )}
            </motion.button>
          );
        })}
      </div>

      <button
        onClick={() => shiftWeek(1)}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors shrink-0"
        aria-label="Next week"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

```

---

### FILE: src\pages\dashboard\ScheduleCard.tsx (461 lines)

```tsx
// ============================================================
// DeskFlow Dashboard — ScheduleCard (Revamped v2)
// Skills: Human-Centric UX (current block prominence, empty states),
//         Impeccable Design (color-coded blocks, time hierarchy, 8px grid),
//         MCP (SpotlightCard from ReactBits, AnimatedGradientText from Magic UI,
//              BorderBeam on current block),
//         Signature Design (micro-detail: pulsing "NOW" indicator)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, MapPin, Plus, X, Edit3, Trash2,
  BookOpen, FlaskConical, Brain, FileText, Users, MoreHorizontal, Sun
} from 'lucide-react';
import { BorderBeam } from '../../components/ui/border-beam';
import { AnimatedGradientText } from '../../components/ui/animated-gradient-text';
import { SpotlightCard } from '../../components/dashboard/SpotlightCard';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Select, SelectItem } from '../../components/ui/select';
import type { ScheduleEntry, ScheduleCategory } from './types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const COLORS = ['#22d3ee', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

const CATEGORY_ICONS: Record<ScheduleCategory, React.ReactNode> = {
  class: <BookOpen size={12} />,
  lab: <FlaskConical size={12} />,
  study: <Brain size={12} />,
  exam: <FileText size={12} />,
  meeting: <Users size={12} />,
  other: <MoreHorizontal size={12} />,
};

const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  class: 'Class', lab: 'Lab', study: 'Study', exam: 'Exam', meeting: 'Meeting', other: 'Other',
};

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(start: string, end: string): string {
  const mins = parseTime(end) - parseTime(start);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getMinutesUntil(timeStr: string): number {
  const now = new Date();
  return parseTime(timeStr) - (now.getHours() * 60 + now.getMinutes());
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2 } },
};

const formVariants = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.25 } },
};

interface ScheduleCardProps {
  entries: ScheduleEntry[];
  loading?: boolean;
  error?: string | null;
  onAdd: (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, patch: Partial<ScheduleEntry>) => void;
  onDelete: (id: string) => void;
}

export function ScheduleCard({
  entries, loading = false, error = null, onAdd, onUpdate, onDelete,
}: ScheduleCardProps) {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  const [form, setForm] = useState({
    title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00',
    category: 'class' as ScheduleCategory, color: COLORS[0],
  });

  const dayEntries = useMemo(() =>
    entries.filter(e => e.day_of_week === selectedDay).sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [entries, selectedDay]
  );

  const currentEntry = dayEntries.find(e => {
    const start = parseTime(e.start_time);
    const end = parseTime(e.end_time);
    return nowMinutes >= start && nowMinutes < end;
  });

  const upcomingEntries = dayEntries.filter(e => parseTime(e.start_time) > nowMinutes);
  const pastEntries = dayEntries.filter(e => parseTime(e.end_time) <= nowMinutes);

  const resetForm = () => setForm({ title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00', category: 'class', color: COLORS[0] });

  const startAdd = () => { resetForm(); setForm(p => ({ ...p, day: selectedDay.toString() })); setIsAdding(true); setEditingId(null); };

  const startEdit = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title, location: entry.location || '', day: entry.day_of_week.toString(),
      start: entry.start_time, end: entry.end_time, category: entry.category || 'class', color: entry.color || COLORS[0],
    });
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(), location: form.location.trim() || undefined,
      day_of_week: parseInt(form.day), start_time: form.start, end_time: form.end,
      category: form.category, color: form.color,
    };
    if (editingId) { onUpdate(editingId, payload); setEditingId(null); }
    else { onAdd(payload); setIsAdding(false); }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) { onDelete(id); setDeleteConfirmId(null); }
    else { setDeleteConfirmId(id); setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000); }
  };

  const isToday = selectedDay === new Date().getDay();

  if (loading) {
    return (
      <SpotlightCard spotlightColor="rgba(236, 72, 153, 0.08)" className="rounded-xl">
        <div className="relative rounded-xl overflow-hidden bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/40 p-5 min-h-[400px]">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-zinc-800 rounded w-1/3" />
            <div className="flex gap-2">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-8 bg-zinc-800/50 rounded-md flex-1" />)}</div>
            {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-800/30 rounded-lg" />)}
          </div>
        </div>
      </SpotlightCard>
    );
  }

  if (error) {
    return (
      <SpotlightCard spotlightColor="rgba(236, 72, 153, 0.08)" className="rounded-xl">
        <div className="relative rounded-xl overflow-hidden bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/40 p-5 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
          <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
            <Calendar size={24} className="text-zinc-600" />
          </div>
          <p className="text-[14px] font-medium text-zinc-400">Could not load schedule</p>
          <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">{error}</p>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard spotlightColor="rgba(236, 72, 153, 0.08)" className="rounded-xl">
      <div className="relative rounded-xl overflow-hidden bg-zinc-950/50 backdrop-blur-xl border border-zinc-800/40 p-5 min-h-[400px] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
        {currentEntry && isToday && <BorderBeam size={200} duration={12} colorFrom="#ec4899" colorTo="#f472b6" />}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Calendar size={15} className="text-pink-400" />
            </div>
            <div>
              <AnimatedGradientText className="text-[15px] font-semibold" gradientFrom="#ec4899" gradientTo="#f472b6">
                {DAYS[selectedDay]}&apos;s Schedule
              </AnimatedGradientText>
              <p className="text-[11px] text-zinc-500">
                {dayEntries.length === 0 ? 'Nothing scheduled' : `${dayEntries.length} block${dayEntries.length > 1 ? 's' : ''}`}
                {isToday && ' · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={startAdd}
              className="w-8 h-8 rounded-md bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              aria-label={isAdding || editingId ? 'Cancel' : 'Add schedule entry'}
            >
              {isAdding || editingId ? <X size={14} /> : <Plus size={14} />}
            </motion.button>
          </div>
        </div>

        {/* Day selector */}
        <div className="flex items-center gap-1 mb-3 shrink-0">
          {DAY_LETTER.map((letter, i) => {
            const isSelected = i === selectedDay;
            const hasEntries = entries.some(e => e.day_of_week === i);
            return (
              <motion.button
                key={i}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setSelectedDay(i); setIsAdding(false); setEditingId(null); }}
                className={`flex-1 h-8 rounded-md text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                    : 'bg-zinc-900/40 text-zinc-600 border border-transparent hover:bg-zinc-800/50 hover:text-zinc-400'
                }`}
              >
                <span className="relative">
                  {letter}
                  {hasEntries && !isSelected && (
                    <span className="absolute -top-1 -right-1.5 w-1 h-1 rounded-full bg-pink-500/60" />
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Add/Edit Form */}
        <AnimatePresence>
          {(isAdding || editingId) && (
            <motion.div variants={formVariants} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50 space-y-2.5 mb-3">
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Entry title (e.g. Linear Algebra)"
                  autoFocus
                  className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-pink-500/50 text-[13px] h-9"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    placeholder="Location (optional)"
                    className="flex-1 bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-pink-500/50 text-[13px] h-9"
                  />
                  <Select value={form.day} onValueChange={v => setForm(p => ({ ...p, day: v }))} className="w-[90px]">
                    {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{DAY_SHORT[i]}</SelectItem>)}
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <Input type="time" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-pink-500/50 text-[13px] h-9" />
                    <span className="text-zinc-600 text-xs">to</span>
                    <Input type="time" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))} className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-pink-500/50 text-[13px] h-9" />
                  </div>
                  <div className="flex items-center gap-1">
                    {COLORS.map(c => (
                      <motion.button
                        key={c}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as ScheduleCategory }))} className="w-[110px]">
                    {(Object.keys(CATEGORY_LABELS) as ScheduleCategory[]).map(cat => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </Select>
                  <div className="flex-1" />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="sm" onClick={handleSave} className="bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 text-[12px] h-8">
                      {editingId ? 'Save' : 'Add'}
                    </Button>
                  </motion.div>
                  <Button size="sm" variant="ghost" onClick={() => { resetForm(); setIsAdding(false); setEditingId(null); }} className="text-zinc-400 hover:text-white text-[12px] h-8">
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule List */}
        {dayEntries.length === 0 && !isAdding && !editingId ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-10"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
              <Sun size={24} className="text-zinc-600" />
            </div>
            <p className="text-[14px] font-medium text-zinc-400">Nothing scheduled for {DAY_SHORT[selectedDay]}</p>
            <p className="text-[12px] text-zinc-600 mt-1 max-w-[200px]">
              Add classes, study blocks, meetings, or exams to build your weekly routine
            </p>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={startAdd}
              className="mt-3 px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-colors text-[12px] font-medium"
            >
              <Plus size={12} className="inline mr-1" />
              Add Entry
            </motion.button>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex-1 space-y-2 min-h-0 overflow-y-auto">
            {/* Current block */}
            <AnimatePresence mode="popLayout">
              {currentEntry && isToday && (
                <motion.div
                  key={`current-${currentEntry.id}`}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  layout
                  className="relative"
                >
                  <div className="relative p-3 rounded-lg border border-pink-500/30 bg-pink-500/[0.08] overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: currentEntry.color || '#ec4899' }} />
                    <div className="flex items-start justify-between pl-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0"
                          />
                          <span className="text-sm font-semibold text-zinc-100">{currentEntry.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/20 text-pink-400 border border-pink-500/20 shrink-0">
                            NOW
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatTime(currentEntry.start_time)} – {formatTime(currentEntry.end_time)}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-mono">{formatDuration(currentEntry.start_time, currentEntry.end_time)}</span>
                          {currentEntry.location && (
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                              <MapPin size={10} />{currentEntry.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(currentEntry)} className="w-6 h-6 rounded bg-zinc-800/50 text-zinc-400 hover:text-white flex items-center justify-center">
                          <Edit3 size={10} />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(currentEntry.id)} className="w-6 h-6 rounded bg-zinc-800/50 text-zinc-400 hover:text-red-400 flex items-center justify-center">
                          <Trash2 size={10} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upcoming blocks */}
            {upcomingEntries.map((entry) => {
              const minsUntil = getMinutesUntil(entry.start_time);
              return (
                <motion.div key={entry.id} variants={itemVariants} initial="hidden" animate="show" exit="exit" layout className="group">
                  <div className="relative p-3 rounded-lg border border-zinc-800/50 hover:border-zinc-700/40 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all duration-200">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: entry.color || '#6b7280' }} />
                    <div className="flex items-start justify-between pl-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{entry.title}</span>
                          <span className="text-[10px] text-zinc-600 px-1 py-0.5 rounded bg-zinc-800/50 border border-zinc-700/30 flex items-center gap-1">
                            {CATEGORY_ICONS[entry.category || 'other']}
                            {CATEGORY_LABELS[entry.category || 'other']}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-zinc-500 font-mono">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                          <span className="text-[11px] text-zinc-600 font-mono">{formatDuration(entry.start_time, entry.end_time)}</span>
                          {entry.location && (
                            <span className="text-[11px] text-zinc-600 flex items-center gap-1"><MapPin size={10} />{entry.location}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isToday && minsUntil > 0 && minsUntil < 180 && (
                          <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
                            in {minsUntil}m
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(entry)} className="w-6 h-6 rounded bg-zinc-800/50 text-zinc-400 hover:text-white flex items-center justify-center">
                            <Edit3 size={10} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(entry.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${deleteConfirmId === entry.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800/50 text-zinc-400 hover:text-red-400'}`}>
                            <Trash2 size={10} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Past entries */}
            {isToday && pastEntries.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] text-zinc-700 uppercase tracking-wider font-medium mb-1.5 px-1">Completed today</div>
                {pastEntries.map(entry => (
                  <motion.div key={entry.id} variants={itemVariants} initial="hidden" animate="show" className="flex items-center gap-2 p-2 rounded-md opacity-40 hover:opacity-70 transition-opacity">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: entry.color || '#6b7280' }} />
                    <span className="text-[12px] text-zinc-500 flex-1">{entry.title}</span>
                    <span className="text-[10px] text-zinc-700 font-mono">{formatTime(entry.start_time)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </SpotlightCard>
  );
}

```

---

### FILE: src\types\goals.ts (229 lines)

```tsx
// ============================================================
// DeskFlow Goals — Canonical Type Definitions
// Single source of truth. All other files re-export from here.
// ============================================================

export type GoalCategory = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships' | 'reflection';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'longterm';
export type GoalStatus = 'active' | 'done' | 'archived' | 'failed' | 'missed';
export type GoalSource = 'manual' | 'ai' | 'system';
export type TargetType = 'time' | 'completion' | 'external' | 'habit' | 'cross_feature';
export type TrackingMode = 'system' | 'manual' | 'hybrid';

export interface CompletionLogic {
  lateAllowed: boolean;
  gracePeriodMinutes: number;
  partialCredit: boolean;
  streakOnMiss: 'reset' | 'continue' | 'pause';
}

export const DEFAULT_COMPLETION_LOGIC: CompletionLogic = {
  lateAllowed: false,
  gracePeriodMinutes: 0,
  partialCredit: false,
  streakOnMiss: 'reset',
};

export interface CadenceConfig {
  type: 'fixed' | 'rolling' | 'flexible';
  fixedDays: number[]; // 0-6 (Sun-Sat)
  rollingTarget: number; // e.g., 3 times per week
  flexibleWindowDays: number; // e.g., any 5 of 7 days
}

export const DEFAULT_CADENCE_CONFIG: CadenceConfig = {
  type: 'fixed',
  fixedDays: [],
  rollingTarget: 1,
  flexibleWindowDays: 7,
};

export interface CrossFeatureLink {
  feature: 'learn' | 'finance' | 'external' | 'ide' | 'focus';
  entityId: string;
  label: string;
}

export interface GoalTarget {
  type: TargetType;
  targetSeconds?: number;
  maxExternalSeconds?: number;
  matchCategory?: string;
  matchApps?: string[];
  done?: boolean;
}

export interface GoalLink {
  label: string;
  url: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  createdAt: string;

  // Existing extended fields
  parentId?: string;
  parentIds?: string[];
  streak?: number;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: {
    enabled: boolean;
    mode: 'positive' | 'avoidance';
    keywords: string[];
    minMinutes: number;
  };
  linkedScheduleId?: string;
  journalText?: string;
  slippedCount?: number;
  deadline?: string;

  // NEW: Unified fields (Phase 1+)
  // Optional in the migration window; hydrated goals receive defaults.
  trackingMode?: TrackingMode;
  completionLogic?: CompletionLogic;
  cadenceConfig?: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
  externalActivityId?: number | null;
}

export interface LongTermGoal {
  id: string;
  title: string;
  category: GoalCategory;
  description?: string;
  deadline?: string;
  progress?: number;
  priority?: number;
  status?: string;
  source?: string;
  links?: GoalLink[];
}

// Legacy GoalStore status mapping
export function mapLegacyStatus(status: string): GoalStatus {
  const map: Record<string, GoalStatus> = {
    'suggested': 'active',
    'pending': 'active',
    'in-progress': 'active',
    'completed': 'done',
    'overdue': 'missed',
    'slipped': 'missed',
    'dismissed': 'archived',
  };
  return map[status] || (status as GoalStatus);
}

// Helper: create a Goal with sensible defaults for new fields
export function goalDefaults(partial: Partial<Goal>): Goal {
  return {
    id: partial.id || '',
    title: partial.title || '',
    category: partial.category || 'work',
    target: partial.target || { type: 'completion' },
    period: partial.period || 'daily',
    status: partial.status || 'active',
    date: partial.date || new Date().toISOString().slice(0, 10),
    source: partial.source || 'manual',
    links: partial.links || [],
    createdAt: partial.createdAt || new Date().toISOString(),
    trackingMode: partial.trackingMode || 'manual',
    completionLogic: partial.completionLogic || DEFAULT_COMPLETION_LOGIC,
    cadenceConfig: partial.cadenceConfig || DEFAULT_CADENCE_CONFIG,
    ...partial,
  } as Goal;
}

// Helper: serialize Goal for DB storage (JSON columns)
export function goalToRow(goal: Partial<Goal>): Record<string, unknown> {
  return {
    id: goal.id,
    date: goal.date,
    title: goal.title,
    description: goal.description || null,
    category: goal.category || 'work',
    target_type: goal.target?.type || 'completion',
    target_seconds: goal.target?.targetSeconds || null,
    match_category: goal.target?.matchCategory || null,
    status: goal.status || 'active',
    period: goal.period || 'daily',
    source: goal.source || 'manual',
    links: JSON.stringify(goal.links || []),
    progress_seconds: goal.progressSeconds || 0,
    completed_at: goal.completedAt || null,
    priority: goal.priority ?? 0,
    parent_id: goal.parentId || null,
    parent_ids: JSON.stringify(goal.parentIds || []),
    deadline: goal.deadline || null,
    is_habit: goal.isHabit ? 1 : 0,
    cadence: goal.cadence || null,
    weekly_target_days: JSON.stringify(goal.weeklyTargetDays || []),
    detection: goal.detection ? JSON.stringify(goal.detection) : null,
    linked_schedule_id: goal.linkedScheduleId || null,
    journal_text: goal.journalText || null,
    slipped_count: goal.slippedCount || 0,
    completion_config: JSON.stringify(goal.completionLogic || DEFAULT_COMPLETION_LOGIC),
    tracking_mode: goal.trackingMode || 'manual',
    cadence_config: JSON.stringify(goal.cadenceConfig || DEFAULT_CADENCE_CONFIG),
    cross_feature_link: goal.crossFeatureLink ? JSON.stringify(goal.crossFeatureLink) : null,
    external_activity_id: goal.externalActivityId || null,
  };
}

// Helper: hydrate DB row to Goal
export function rowToGoal(row: Record<string, unknown>): Goal {
  const parseJson = (raw: unknown, fallback: unknown = undefined) => {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return fallback; }
    }
    return raw ?? fallback;
  };
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    description: row.description ? String(row.description) : undefined,
    category: (row.category || 'work') as GoalCategory,
    target: {
      type: (row.target_type || 'completion') as TargetType,
      targetSeconds: row.target_seconds ? Number(row.target_seconds) : undefined,
      matchCategory: row.match_category ? String(row.match_category) : undefined,
    },
    period: (row.period || 'daily') as GoalPeriod,
    status: (row.status || 'active') as GoalStatus,
    date: String(row.date || ''),
    source: (row.source || 'manual') as GoalSource,
    links: parseJson(row.links, []),
    progressSeconds: row.progress_seconds ? Number(row.progress_seconds) : 0,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at || ''),
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    parentIds: parseJson(row.parent_ids, []),
    streak: row.streak ? Number(row.streak) : undefined,
    isHabit: row.is_habit === 1,
    cadence: row.cadence ? String(row.cadence) as 'daily' | 'weekly' : undefined,
    weeklyTargetDays: parseJson(row.weekly_target_days, []),
    detection: parseJson(row.detection, undefined),
    linkedScheduleId: row.linked_schedule_id ? String(row.linked_schedule_id) : undefined,
    journalText: row.journal_text ? String(row.journal_text) : undefined,
    slippedCount: row.slipped_count ? Number(row.slipped_count) : undefined,
    deadline: row.deadline ? String(row.deadline) : undefined,
    trackingMode: (row.tracking_mode || 'manual') as TrackingMode,
    completionLogic: parseJson(row.completion_logic || row.completion_config, DEFAULT_COMPLETION_LOGIC),
    cadenceConfig: parseJson(row.cadence_config, DEFAULT_CADENCE_CONFIG),
    crossFeatureLink: row.cross_feature_link ? parseJson(row.cross_feature_link, null) : null,
    externalActivityId: row.external_activity_id ? Number(row.external_activity_id) : null,
  };
}

```

---

### FILE: src\components\dashboard\types.ts (114 lines)

```tsx
// ============================================================
// DeskFlow Dashboard — Shared Types
// Goal-related types re-exported from src/types/goals.ts (canonical)
// ============================================================

export type {
  GoalCategory, GoalPeriod, GoalStatus, GoalSource, TargetType,
  GoalLink, GoalTarget, Goal, LongTermGoal,
  TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink,
} from '../../types/goals';
export { mapLegacyStatus, goalDefaults, goalToRow, rowToGoal } from '../../types/goals';

// Dashboard-only types (not goal-related)
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type DeadlineStatus = 'pending' | 'completed' | 'overdue';
export type DeadlineCategory = 'academic' | 'work' | 'personal' | 'health';
export type ScheduleCategory = 'class' | 'lab' | 'study' | 'exam' | 'meeting' | 'other';

export interface Deadline {
  id: string;
  title: string;
  due_date: string;
  status: DeadlineStatus;
  course?: string;
  priority: Priority;
  description?: string;
  category?: DeadlineCategory;
  recurrence?: string;
  remind_at?: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  text: string;
  due_date: string | null;
  goal_id: string | null;
  done: boolean;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  location?: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  category?: ScheduleCategory;
  color?: string;
  goal_id?: string; // linked goal
  createdAt: string;
}

export interface CategoryBalance {
  category: GoalCategory;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardInsights {
  streak: number;
  longestStreak: number;
  momentum: number; // 0-100
  categoryBalance: CategoryBalance[];
  completionRate: number;
  urgentDeadlines: number;
  focusTimeMinutes: number;
  aiSuggestionCount: number;
}

export interface MomentumScore {
  score: number; // 0-100
  streak: number;
  consistency: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  completionRate: number;
  scheduleAdherence: number;
}

export interface DashboardState {
  goals: Goal[];
  deadlines: Deadline[];
  schedule: ScheduleEntry[];
  longTermGoals: LongTermGoal[];
  suggestions: Goal[];
  insights: DashboardInsights;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// IPC API shape (augmented in global scope)
declare global {
  interface Window {
    deskflowAPI?: {
      getGoals: (date: string) => Promise<{ goals: Goal[] }>;
      saveGoal: (date: string, goal: Goal) => Promise<{ success: boolean; id?: string }>;
      deleteGoal: (goalId: string) => Promise<{ success: boolean }>;
      getLongtermGoals: () => Promise<{ goals: LongTermGoal[] }>;
      suggestGoals: (date: string, ctx: unknown) => Promise<{ suggestions: Goal[] }>;
      getDeadlines: (params: { days?: number }) => Promise<{ deadlines: Deadline[] }>;
      addDeadline: (dl: Omit<Deadline, 'id'>) => Promise<{ success: boolean; id: string }>;
      updateDeadline: (id: string, patch: Partial<Deadline>) => Promise<{ success: boolean }>;
      deleteDeadline: (id: string) => Promise<{ success: boolean }>;
      getSchedule: () => Promise<{ entries: ScheduleEntry[] }>;
      addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<{ success: boolean; id: string }>;
      updateScheduleEntry: (id: string, patch: Partial<ScheduleEntry>) => Promise<{ success: boolean }>;
      deleteScheduleEntry: (id: string) => Promise<{ success: boolean }>;
      getMomentumScore: (date?: string) => Promise<MomentumScore>;
    };
  }
}

```

