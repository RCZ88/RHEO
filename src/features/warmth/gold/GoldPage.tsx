// src/features/warmth/gold/GoldPage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Flame, Plus, Bell, Trash2, CheckCircle2, ChevronDown, ChevronUp,
  CalendarDays, Calendar, NotebookPen, TrendingUp, ChevronLeft, ChevronRight,
  Sparkles, Lightbulb, Timer, Code2, Activity, Pencil, X, Wand2, Clock,
  RefreshCw, Layers,
} from 'lucide-react';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import { WarmCard } from '../WarmCard';
import { GoalCard, GoalCardSkeleton, GoalEmptyState, GoalErrorState } from '../../../components/goals/GoalCard';
import { CriteriaBuilder } from '../../../components/goals/CriteriaBuilder';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import { MissedGoalRecoveryBanner } from '../../../components/goals/MissedGoalRecoveryBanner';
import { getMissedGoals } from '../../../components/goals/GoalCompletionEngine';
import { GoalAICoach } from '../../../components/goals/GoalAICoach';
import { WeeklyGoalsView } from '../../../components/goals/WeeklyGoalsView';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import { NumberTicker } from '../../../components/ui/number-ticker';
import { BorderBeam } from '../../../components/ui/border-beam';
import { AnimatedCircularProgressBar } from '../../../components/ui/animated-circular-progress-bar';
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper';
import type { Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';
import type { GoalStatus } from '../../../types/goals';
import { Button } from '../../../components/ui/button';
import { ConnectionExplorer } from '../../../components/goals/ConnectionExplorer';
import { scaleOf } from '../../../lib/riverMath';
import { loadCompletions } from '../../covenant/storage';
import { GoalLanguageParser } from '@/components/goals/GoalLanguageParser';
import { ProgressRing } from '@/components/ai/canvas/cards/ProgressRing';

import { goalKind, isWeeklyish, type GoalKind } from '@/components/goals/goalPredicates';
import { todayStr, addDaysStr, mondayOf, daysUntil } from '@/lib/week';
import { formatTime, prettyDate } from '@/lib/format';
import { covenantStreak, covenantDoneDates } from '@/lib/covenant';
import { CATEGORY_DOTS } from '@/lib/CategoryColors';
import { StatPill } from '@/components/goals/StatPill';
import { DayRing } from '@/components/goals/DayRing';
import { WeekReview } from '@/components/goals/WeekReview';
import { HabitTracker } from '@/components/goals/HabitTracker';

/* ═══════════════════ helpers ═══════════════════ */

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

/* smart prompt generation — blend soft + hard into 4 max reflection prompts.
   Spec §7.3 does NOT list buildPrompts as a duplicate: after HabitsPage was
   deleted this has exactly one consumer, so it stays local rather than being
   hoisted into a module with a single caller. */
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

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatPhaseRange(sy?: number|null, sm?: number|null, ey?: number|null, em?: number|null): string {
  const start = sy ? `${MONTH_ABBR[(sm || 1) - 1] ?? ''} ${sy}` : '';
  if (!ey) return start ? `${start} — present` : '';
  const end = `${MONTH_ABBR[(em || 12) - 1] ?? ''} ${ey}`;
  return start ? `${start} — ${end}` : end;
}

type CalendarSide = 'left' | 'right';

// Side preference persisted in the preference store (mirror CardLibrary pattern, W-4).
// No new localStorage key (R-59 / G-GL-4).
export function useCalendarSide(): [CalendarSide, () => void] {
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

interface RadarMark { color: string; label: string; }

/* ═══════════════════ unique UI pieces ═══════════════════ */

/* ── SealedList: a per-group disclosure over its own sealed goals ──
   Three copies of this markup previously shared ONE boolean, which produced two
   bugs at once: the Habits and Routines copies rendered no list at all, and all
   three opened and closed in unison. Each instance now owns its own state and
   renders the caller's card, so a sealed goal is always visible somewhere once
   expanded — which is what makes the group's empty state honest. */
function SealedList({ goals, noun, renderCard }: {
  goals: Goal[];
  noun: string;
  renderCard?: (g: Goal) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false)
  if (goals.length === 0) return null
  const plural = `${goals.length} ${noun}${goals.length === 1 ? '' : 's'}`
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 rounded"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Sealed ({plural})
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-1.5 mt-2"
          >
            {goals.map(goal => (renderCard ? renderCard(goal) : <GoalCard key={goal.id} goal={goal} />))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── GroupHeader: one row per concept group ──
   The group NAME is the point. Before this change the list was one undifferentiated
   run of GoalCards, so a habit, a weekly routine and a long-term destination looked
   identical in the column — which is what made "the routine and the goal are the
   same thing" true from the user's side even where the data model was correct.
   A header is also the scroll anchor, so it stays rendered when the group is empty:
   a ⌘K jump to an empty group must still land somewhere legible. */
function GroupHeader({ id, icon, title, count, noun }: {
  id: string; icon: React.ReactNode; title: string; count: number; noun: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <h3 id={id} className="text-[13px] font-semibold text-zinc-100">{title}</h3>
      {count > 0 && (
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {count} {noun}{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

/* This was a hardcoded DARK fill — `bg-[rgba(24,24,27,0.60)]` with no light
   branch — so on Warm Paper the pill composited to rgb(112,111,111): a grey
   smudge that swallowed its own contents. Measured on the streak pill, the
   Flame sat at 1.01:1 and the Sealed check at 1.10:1 against it. The token
   pair keeps the glass read in both themes. */
const GLASS = 'bg-[rgba(24,24,27,0.60)] light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] light:border-[var(--ws-border)]';

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
        <DayRing date={date} done={done} total={total} />
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
                    : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border-transparent hover:bg-zinc-800/30 hover:border-zinc-800/50'
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
                        background: isDone ? CATEGORY_DOTS[grp.category]?.dot : 'transparent',
                        borderColor: isDone ? CATEGORY_DOTS[grp.category]?.dot : `${CATEGORY_DOTS[grp.category]?.dot}55`,
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

/* `todayGoals` was declared here, destructured, and NEVER READ — and the caller
   was feeding it the long-term bucket through an `as unknown as Goal[]` cast. So
   the cast was a type lie with no consumer behind it.

   Worse, it hid a real defect: the Vault's list renders from `longTermGoals`
   (`api.getLongtermGoals`), a DIFFERENT query from the `goals` batch that produces
   `vaultGoals`. Two queries, one concept, no reconciliation — so the group header
   could count N while the list rendered M. That is the same "two sources that can
   disagree" failure as the double-reading completions.

   The prop is deleted rather than repointed: `longTermGoals` is already the
   component's real source, and the group header below now counts that same
   array, so the number and the list are the same fact. */
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
            className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <FieldAIButton
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
              className="flex-1 min-w-0 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
            >
              {Object.keys(CATEGORY_DOTS).map(k => (
                <option key={k} value={k}>{CATEGORY_DOTS[k].label}</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
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
            className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 [color-scheme:dark] transition-colors"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Description (optional)…"
            className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
          />
          <FieldAIButton
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
              <div key={ltg.id} className="group flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 hover:border-zinc-700/50 transition-colors">
                <ProgressRing pct={ltg.progress ?? 0} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-300 truncate">{ltg.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_DOTS[ltg.category || 'work']?.dot }} />
                    <span className="text-[9px] text-zinc-600">{(CATEGORY_DOTS[ltg.category || 'work'] || CATEGORY_DOTS.work).label}</span>
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
function ReflectionCard({ date, data, summary, streak, onSave }: {
  date: string; data: DailyReflection; summary: string;
  /* Passed in, not read here. The card used to read the covenant store itself,
     which meant the page read it twice — once for the recap's day-dots and once
     for this streak — and two reads taken at different moments can disagree. The
     page reads once and hands the same array to both. */
  streak: number;
  onSave: (s: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [promptOpen, setPromptOpen] = useState(true);
  const prompts = useMemo(() => buildPrompts(data, streak), [data, streak]);
  const text = draft[date] ?? summary;
  const dirty = draft[date] !== undefined;

  /* The tint is the ICON MARK on a raised tile, so it needs the ink step, not
   * the fill step. The raw -400 hexes measured 1.61/1.75/1.86/4.09/2.71:1 on
   * #fcfbf8 — the Covenant (streak) Flame was effectively invisible in light.
   * `--color-*-ink` resolves to the bright step in dark and a darkened step in
   * `html.light`, so this row reads correctly in both themes with no `light:`
   * branch here. */
  const tiles: { icon: typeof Timer; label: string; value: string; tint: string }[] = [
    { icon: Timer,    label: 'Productive',  value: formatTime(data.productiveSec), tint: 'var(--color-amber-400)' },
    { icon: Code2,    label: 'Coding',      value: formatTime(data.codingSec),     tint: 'var(--color-cyan-ink)' },
    { icon: Target,   label: 'Goals',       value: `${data.goals.completed}/${data.goals.total}`, tint: 'var(--color-emerald-ink)' },
    { icon: Activity, label: 'Habits',      value: `${data.habits.completed}/${data.habits.total}`, tint: 'var(--color-violet-ink)' },
    { icon: Flame,    label: 'Covenant',    value: `${streak}d`,                   tint: 'var(--color-orange-ink)' },
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
          <div key={t.label} className="rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 px-2.5 py-2">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)] mb-1">
              <t.icon size={11} style={{ color: t.tint }} />
              {t.label}
            </div>
            <div className="text-[14px] font-semibold text-zinc-200 light:text-[var(--text-primary)] tabular-nums">{t.value}</div>
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
              /* Ruled-paper lines behind the reflection box. `rgba(63,63,70,.25)` is a cool
               * grey tuned for a dark field; on cream it reads as dirt. */
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, var(--ws-border) 27px, var(--ws-border) 28px)',
            }}
          />
        </VoiceInputWrapper>
        <FieldAIButton
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
/* `onManagePhases` is a PROP, not a local window event.
   The previous implementation did
     localStorage.setItem('life-view-mode','river') + dispatchEvent('rheo:life-view-mode')
   and NOTHING in the repo listened for that event — verified by grep. So the
   "Manage phases" button was a dead control: it looked like a navigator and did
   nothing. Two fragile channels (a storage write and a global event) could not
   have been verified anyway without a build.
   GoldPage also mounts standalone at `/gold`, where there is no River to switch
   to — so when the prop is absent the button is not rendered at all, rather than
   rendering a control that cannot work. */
export default function GoldPage({ embedded, onManagePhases }: {
  embedded?: boolean
  /** Provided only when Gold is rendered inside LifePage, which owns the view mode. */
  onManagePhases?: () => void
}) {
  const api = (window as any).deskflowAPI;
  const [side, toggleSide] = useCalendarSide();

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
  /* ONE flag shared by all three groups was wrong twice over: the Habits
     and Routines toggles rendered nothing at all (only completedDailies was
     ever mapped), and all three opened and closed together. State now lives
     per group, inside SealedList, so each disclosure is independent. */
  const [showSuggested, setShowSuggested] = useState(false);
  const [hubEntity, setHubEntity] = useState<{ type: 'goal' | 'habit'; id: string; title: string } | null>(null);
  const [connCounts, setConnCounts] = useState<Record<string, number>>({});
  const [showLangParser, setShowLangParser] = useState(false);
  // Schedule default = per-day (only the selected day's fixed blocks).
  // Toggle to show the whole week's fixed schedule at once.
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; createdAt: string; goalId?: string; scheduleId?: string; deadlineId?: string; parentTodoId?: string; dueDate?: string }[]>([]);
  const [expandedHierarchy, setExpandedHierarchy] = useState<Set<string>>(new Set());

  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);

  /* ── loading ──
     Routines must ALWAYS be visible — not hidden behind a date window. We load
     the entire goal set (wide range, de-duped by id) so every saved routine
     shows regardless of which day is selected. The selectedDate only affects
     the calendar strip highlight + "today" markers, never what's listed. */
  const loadGoals = useCallback(async (_date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.getGoalsBatch('2000-01-01', addDaysStr(todayStr(), 120));
      const map = new Map<string, any>();
      for (const d of (res.days || []) as any[]) {
        for (const g of (d.goals || []) as any[]) {
          if (!g.id) continue; // skip orphaned/junk rows (null id from automation)
          map.set(g.id, g);
        }
      }
      const loaded = [...map.values()];
      setGoals(loaded);
      // Connection counts for the "N linked" chips. Best-effort: a failure here
      // must not stop the goal list from rendering.
      try {
        const res = await api.goalGetConnectionsBulk?.(loaded.map((g: any) => g.id).filter(Boolean));
        if (res?.success && res.counts) {
          const flat: Record<string, number> = {};
          for (const [k, v] of Object.entries(res.counts as Record<string, any>)) flat[k] = (v as any)?.total ?? 0;
          setConnCounts(flat);
        }
      } catch { /* non-critical */ }
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

  /* ── CRUD (optimistic) ── */
  // If the user asked to bundle a goal's selected apps into a Focus Group, create one.
  const createFocusGroupFromApps = async (apps: string[], groupName?: string) => {
    if (!apps.length) return;
    try {
      const name = (groupName && groupName.trim()) || apps.slice(0, 2).join(' + ') + (apps.length > 2 ? ` +${apps.length - 2}` : '');
      await (window as any).deskflowAPI?.focusGroup?.save?.({
        name,
        description: `Auto-created from app-usage goal (${apps.length} app${apps.length > 1 ? 's' : ''}).`,
        allowed_apps: apps,
        allowed_domains: [],
        allowed_categories: [],
        strictness: 'non_allowed',
      });
    } catch { /* best-effort: failure to create the group must not break goal save */ }
  };

  const handleAdd = async () => {
    if (!newCriteria.title.trim()) return;
    const goal = criteriaToGoal(newCriteria, selectedDate);
    setGoals(prev => [...prev, goal]);
    setIsAdding(false); setNewCriteria(defaultCriteria);
    if (newCriteria.appUsage?.groupAsFocus && newCriteria.appUsage.apps.length) {
      await createFocusGroupFromApps(newCriteria.appUsage.apps, newCriteria.appUsage.focusGroupName);
    }
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

  /* toggle a habit instance on a specific day (WeekBoard) */
  /* ── suggested-goal review queue ──
     save-goal is INSERT OR REPLACE keyed on id, so accept/dismiss is a status
     write on the existing row. Dismiss DELETES: a dismissed suggestion is not
     work you declined, it is noise you asked to remove — and there is no
     'dismissed' status in the goals vocabulary to fall back to. */
  const handleAcceptSuggested = async (goal: Goal) => {
    const previous = goal.status;
    setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, status: 'active' as GoalStatus } : g)));
    try {
      const res = await api.saveGoal(goal.date || selectedDate, { ...goal, status: 'active' });
      if (res?.success === false) throw new Error(res.error);
      loadGoals(selectedDate); loadWeek(selectedDate);
    } catch {
      setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, status: previous } : g)));
      setError(`Could not accept "${goal.title}". Try again.`);
    }
  };

  const handleDismissSuggested = async (goal: Goal) => {
    const snapshot = goals;
    setGoals(prev => prev.filter(g => g.id !== goal.id));
    try {
      const res = await api.deleteGoal(goal.id);
      if (res?.success === false) throw new Error(res.error);
    } catch {
      setGoals(snapshot); // restore — never lose the user's data on a failed write
      setError(`Could not dismiss "${goal.title}". Try again.`);
    }
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

  /* ── deadlines + reminders ── */
  /* ── derived ── */
  /* The goals table still carries the legacy AI statuses ('suggested',
     'pending') that the canonical GoalStatus union does not declare, so a
     direct `g.status === 'suggested'` is a type error even though the value is
     really in the DB. Widen locally rather than casting the whole goal away. */
  /* THE PARTITION — ONE bucketing pass, not four filters.
     Four `.filter()` calls were individually defensible and jointly WRONG: the
     cross-product over isHabit x cadence x period found 4 goals landing in two
     buckets (`isHabit && longterm` -> Habits AND Vault; `cadence weekly &&
     longterm` -> Routines AND Vault). That is the original "routine and goal
     are the same thing" bug reproduced one layer up, and it survived my first
     probe because that probe covered 7 shapes instead of the full cross
     product. `goalKind()` is a single ordered chain, so disjointness is a
     property of control flow rather than of five predicates agreeing. */
  const buckets = useMemo(() => {
    const b: Record<GoalKind, Goal[]> = { suggested: [], vault: [], habit: [], routine: [], daily: [] }
    for (const g of goals) b[goalKind(g)].push(g)
    return b
  }, [goals])

  const dailies = buckets.daily
  /* `activeDailies` / `completedDailies` used to be derived here from `goals` in
     one pass each. The bucket refactor left the derivations behind while the
     StatPill row and the Today group kept calling them, so "Active" and "Sealed"
     threw ReferenceError on render — and with no ErrorBoundary above the page,
     that took the whole Life page down with them. */
  const activeDailies = dailies.filter(g => g.status !== 'done')
  const completedDailies = dailies.filter(g => g.status === 'done')
  const habitGoals = buckets.habit
  const routineGoals = buckets.routine
  const vaultGoals = buckets.vault
  /* AI-suggested goals used to be filtered out with no way to reach them, so 11
     rows in the live DB were unreachable. They are a REVIEW QUEUE: the point is
     to accept the ones you want and dismiss the rest. */
  const suggestedGoals = buckets.suggested

  /* Four more derivations the bucket refactor dropped while the JSX kept
     calling them: the Habits and Routines group headers, the Sealed list, and
     the long-term vault's "serving" count. Same failure mode as the pair above —
     each is a ReferenceError on render, and with no ErrorBoundary above the page
     any one of them blanks the whole Life page. */
  const activeHabits = habitGoals.filter(g => g.status !== 'done')
  const activeRoutines = routineGoals.filter(g => g.status !== 'done')
  const completedRoutines = routineGoals.filter(g => g.status === 'done')
  /* `todayGoals` was a PROP of `TheVault`, which was dead code at HEAD — defined,
     never rendered. Inlining the vault's JSX finally gave that reference a
     caller, so the derivation has to exist. `date` is the goal's own day field
     and `selectedDate` is the page's current day, so the count follows day nav. */
  const todayGoals = goals.filter(g => g.date === selectedDate)

  const missedGoals = useMemo(() => getMissedGoals(goals, selectedDate), [goals, selectedDate]);
  const doneCount = goals.filter(g => g.status === 'done').length;
  const tracked = goals.reduce((s, g) => s + (g.progressSeconds || 0), 0);
  const bestStreak = goals.reduce((mx, g) => Math.max(mx, g.streak || 0), 0);
  const weekDates = useMemo(() => {
    const mon = mondayOf(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDaysStr(mon, i));
  }, [selectedDate]);

  /* Week-at-a-glance data for WeekReview. One request per day of the visible
     week, keyed by date; a failed day is simply absent from the map so the bar
     renders empty rather than the whole card erroring. */
  useEffect(() => {
    if (!api?.getDailyReflection) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(weekDates.map(async d => {
          try { return { d, res: await api.getDailyReflection(d) }; }
          catch { return { d, res: null }; }
        }));
        if (cancelled) return;
        const map: Record<string, DailyReflection> = {};
        for (const { d, res } of results) {
          if ((res as any)?.success) {
            map[d] = {
              productiveSec: (res as any).productiveSec || 0,
              codingSec: (res as any).codingSec || 0,
              goals: (res as any).goals || { total: 0, completed: 0 },
              habits: (res as any).habits || { total: 0, completed: 0 },
              reviewSummary: (res as any).reviewSummary || null,
            };
          }
        }
        setWeekReflections(map);
      } catch { if (!cancelled) setWeekReflections({}); }
    })();
    return () => { cancelled = true; };
  }, [weekDates, api]);

  /* Adapt the reflection map to the shared WeekReview's shape. A day absent
     from the map failed to load, so it contributes zeros rather than being
     dropped — a missing day must not shift the other six days out of position
     and silently mis-attribute Monday's total to Sunday. */
  const weekReviewDays = useMemo(() => weekDates.map(d => {
    const r = weekReflections[d];
    return {
      date: d,
      productiveSec: r?.productiveSec || 0,
      goalsCompleted: r?.goals.completed || 0,
      habitsCompleted: r?.habits.completed || 0,
    };
  }), [weekDates, weekReflections]);

  /* The shared WeekReview renders `buildWeeklyReview`'s output rather than
     re-deriving the ratio, so this is the only place that assembles the input.
     `weekGoals` already holds the planned rows for the visible week. */
  /* `habitMisses` was hardcoded `{}`, which made `buildWeeklyReview`'s
     most-skipped-habit branch DEAD at this call site: `mostSkipped` is always
     null, so the "shrink that habit" proposal could never fire and the headline
     never named one. Computed per Claude's rule — a day is a miss only if it is
       · not after today          (a Monday review must not report 6 future days),
       · on/after the habit's own date (days before it existed are not misses),
       · a day the habit was actually scheduled (weeklyTargetDays / fixedDays),
       · and not completed.
     Without the "not after today" clause every Monday would show six misses, which
     is how a metric gets ignored. */
  const habitMisses = useMemo(() => {
    const today = todayStr()
    const out: Record<string, string[]> = {}
    for (const g of goals) {
      if (!g.isHabit) continue
      const cfg: any = (g as any).cadenceConfig
      const scheduled: string[] | null =
        cfg?.type === 'fixed' && Array.isArray(cfg.fixedDays) && cfg.fixedDays.length
          ? cfg.fixedDays
          : null   // null = scheduled every day
      const misses: string[] = []
      for (const d of weekDates) {
        if (d > today) continue                                   // future
        if (d < (g.date || '0000-01-01')) continue                 // predates the habit
        if (scheduled && !scheduled.includes(new Date(d + 'T00:00:00').getDay())) continue
        const row = (weekGoals[d] || []).find(x => x.id === g.id)
        if (row?.status === 'done') continue
        misses.push(d)
      }
      out[g.id] = misses
    }
    return out
  }, [goals, weekDates, weekGoals])

  const habitTitles = useMemo(
    () => Object.fromEntries(goals.filter(g => g.isHabit).map(g => [g.id, g.title])),
    [goals],
  )

  const weekReviewInput = useMemo(() => ({
    weekOf: selectedDate,
    planned: weekDates.flatMap(d => (weekGoals[d] || []).map(g => ({
      id: g.id, title: g.title, date: d, done: g.status === 'done', isHabit: !!g.isHabit,
    }))),
    habitIdsTracked: goals.filter(g => g.isHabit).map(g => g.id),
    habitMisses,
    habitTitles,
    /* `codingSec` was being passed as "minutes spent on NEW material" with a
       straight face. It is not: it is time spent coding, which says nothing about
       whether the work was new or consolidation. Feeding it to the 70% phase-drift
       rule meant the recap could legitimately say "Split your week" off ordinary
       coding time. Declared absent so the rule is skipped until a real
       new-vs-total signal exists. */
    newMinutesByDay: weekDates.map(() => 0),
    hasNewMinuteSignal: false,
    /* totalMinutesByDay stays REAL — productive minutes are genuinely logged —
       it is only the numerator that was fabricated. */
    totalMinutesByDay: weekDates.map(d => Math.round((weekReflections[d]?.productiveSec || 0) / 60)),
    /* Review-queue cards are a Training concept behind its own IPC. Reporting 0
       is honest; inventing a number here would produce a suggestion the user
       cannot act on from this page. */
    queueMissed: 0,
  }), [selectedDate, weekDates, weekGoals, weekReflections, goals, habitMisses, habitTitles]);


  const radarMarks = useMemo(() => {
    const m = new Map<string, RadarMark[]>();
    const push = (date: string, mark: RadarMark) => {
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(mark);
    };
    deadlines.forEach(d => { if (d.due_date && d.status !== 'completed') push(d.due_date, { color: '#f43f5e', label: d.title }); });
    reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: '#fbbf24', label: r.text }); });
    longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: '#a78bfa', label: l.title }); });
    todos.forEach(t => { if (t.dueDate && !t.done) push(t.dueDate, { color: '#a1a1aa', label: t.text }); });
    return m;
  }, [deadlines, reminders, longTermGoals, todos]);

  /* ── one goal row ──
     Extracted because the Today / Habits / Routines groups all render the same
     card. It was inline JSX copied three times in this same commit's precursor,
     which meant the "live focus timer" badge and the connection chip had to be
     kept in sync by hand in three places. */
  const renderGoalCard = (goal: Goal) => (
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
            linkedTotal={connCounts[goal.id]}
            onOpenConnections={g => setHubEntity({ type: g.isHabit ? 'habit' : 'goal', id: g.id, title: g.title })}
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
  );

  /* ONE read of the covenant completions, shared by both consumers.
     They were previously two independent reads: `covenantStreakFrom` inside
     ReflectionCard and `covenantDoneDates()` called INLINE IN JSX, which
     re-read and re-parsed localStorage on every single render. Worse, two reads
     of the same store taken at different moments can disagree — the recap would
     show a streak of 4 next to day-dots for a different 4 days. Reading once
     makes that impossible rather than merely unlikely. */
  const completions = useMemo(() => {
    try { return loadCompletions() } catch { return [] as { date: string }[] }
  }, [])
  const doneDates = useMemo(() => covenantDoneDates(completions), [completions])
  const covenantStreakDays = useMemo(() => covenantStreak(completions, todayStr(), addDaysStr), [completions])

  /* ── render ── */
  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <GoldHeader date={selectedDate} done={doneCount} total={goals.length} tracked={tracked} bestStreak={bestStreak} />

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

      {/* ═══ Two-column layout ═══ */}
      <div className={`flex flex-col lg:flex-row gap-4 ${side === "left" ? "lg:flex-row-reverse" : ""}`}>
        {/* LEFT: Goals + Schedule */}
        <div className="lg:flex-2 min-w-0 space-y-4">

          {/* Stat Pills */}
          <div className="grid grid-cols-4 gap-2">
            <StatPill icon={<Target size={14} />} label="Active" value={activeDailies.length} tone="violet" />
            <StatPill icon={<CheckCircle2 size={14} />} label="Sealed" value={completedDailies.length} tone="emerald" />
            <StatPill icon={<Flame size={14} />} label="Streak" value={bestStreak} tone="amber" />
            <StatPill icon={<Clock size={14} />} label="Tracked" value={formatTime(tracked)} tone="cyan" />
          </div>

          {/* Weekly Goals Overview */}
          <WeeklyGoalsView
            weekGoals={weekGoals}
            weekDates={weekDates}
            selectedDate={selectedDate}
            onToggle={handleToggle}
            onEdit={handleEditStart}
            onDelete={handleDelete}
          />

          {/* Goals are shown in the left column via the dedicated week-goals section, so no extra DeadlineRadar/BellBoard is needed on the right. */}

          {/* Goal controls */}
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-zinc-200">{prettyDate(selectedDate)}</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowLangParser(!showLangParser)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150 ${
                  showLangParser ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                <Wand2 size={12} /> AI
              </button>
              <button
                onClick={() => { setIsAdding(!isAdding); setNewCriteria(defaultCriteria); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-150 ${
                  isAdding ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                {isAdding ? <X size={13} /> : <Plus size={13} />}
                {isAdding ? 'Cancel' : 'Add Routine'}
              </button>
            </div>
          </div>

          {/* AI Language Parser */}
          <AnimatePresence>
            {showLangParser && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <WarmCard ambient>
                  <GoalLanguageParser
                    onAccept={async (parsed) => {
                      const goal: Goal = {
                        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        title: parsed.title, category: parsed.category, period: parsed.period,
                        target: { type: parsed.targetType, targetSeconds: parsed.targetSeconds || undefined },
                        status: 'active', date: selectedDate, source: 'ai', links: [],
                        createdAt: new Date().toISOString(),
                        trackingMode: parsed.trackingMode,
                        completionLogic: parsed.completionLogic,
                        cadenceConfig: parsed.cadenceConfig,
                        crossFeatureLink: parsed.crossFeature || null,
                      };
                      await api.saveGoal(selectedDate, goal);
                      loadGoals(selectedDate);
                      setShowLangParser(false);
                    }}
                    onCancel={() => setShowLangParser(false)}
                  />
                </WarmCard>
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Missed Goals Recovery */}
          <MissedGoalRecoveryBanner missedGoals={missedGoals}
            onRecover={async (goalId, action) => {
              const goal = goals.find(g => g.id === goalId);
              if (!goal) return;
              if (action === 'mark_late') {
                // Accept the miss as completed (late) — keeps the routine, marks it done.
                await api.saveGoal(selectedDate, { ...goal, status: 'done', completedAt: new Date().toISOString() });
              } else if (action === 'reschedule') {
                // Move the routine to today so it's current again.
                await api.saveGoal(selectedDate, { ...goal, date: selectedDate });
              } else {
                // 'dismiss' = accept the miss without deleting: move it to today so it
                // stops nagging but the routine still exists (non-destructive).
                await api.saveGoal(selectedDate, { ...goal, date: selectedDate });
              }
              loadGoals(selectedDate);
            }}
            onDismiss={async () => {
              // Dismiss all missed: move every missed routine to today (non-destructive).
              for (const mg of missedGoals) {
                await api.saveGoal(selectedDate, { ...mg, date: selectedDate });
              }
              loadGoals(selectedDate);
            }} />

          {/* ── GROUP: Today (daily goals) ──
               `data-section` is the anchor the manifest's find.segments scroll
               to. It is written on the GROUP, not on the empty state, so a ⌘K
               jump lands on the group header even when the group is empty —
               otherwise the anchor exists only when there is data, which makes
               deep-nav to an empty group silently scroll to nothing. */}
          <section data-section="life.gold.today" aria-labelledby="grp-today">
            <GroupHeader id="grp-today" icon={<Target size={12} style={{ color: 'var(--page-accent)' }} aria-hidden />}
              title="Today" count={activeDailies.length} noun="goal" />
            {loading ? <GoalCardSkeleton />
              : error ? <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
              : dailies.length === 0 && !isAdding ? (   /* the WHOLE group — see the Habits group for why */
                <WarmCard ambient>
                  <GoalEmptyState onAdd={() => { setIsAdding(true); setNewCriteria(defaultCriteria); }} />
                </WarmCard>
              ) : (
                <div className="space-y-1.5">
                  {activeDailies.map(goal => renderGoalCard(goal))}
                </div>
              )}
          </section>

          {/* ── GROUP: Habits ──
               Spec §1.3: habits render in EXACTLY one place, here, via the
               already-shared HabitTracker. This used to be the whole Habits tab. */}
          <section data-section="life.gold.habits" aria-labelledby="grp-habits" className="mt-4">
            <GroupHeader id="grp-habits" icon={<Flame size={12} style={{ color: 'var(--page-accent)' }} aria-hidden />}
              title="Habits" count={activeHabits.length} noun="habit" />
            {loading ? <GoalCardSkeleton />
              : error ? <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
              : habitGoals.length === 0 ? (   /* the WHOLE group, not the active part */
                                                   /* Sealing your last habit must not make the
                                                      page claim you have none — so this tests
                                                      the group, not the active list. */
                <WarmCard ambient>
                  <p className="text-[12px] text-zinc-400">
                    No habits yet. A habit is a goal that repeats, so add one and it
                    shows up here with its streak.
                  </p>
                </WarmCard>
              ) : (
                /* HabitTracker is the renderer here and NOTHING else is.
                   RESULT.md §1.3 says so explicitly, and the reason is mechanical:
                   HabitTracker loads through `api.getHabits(start, end)` — a
                   different IPC from the `goals` batch this page reads — so
                   rendering GoalCards for the same rows put every habit on screen
                   TWICE, in two different shapes, from two different queries that
                   could disagree. The week-progress strip it draws is also more
                   information than a card carries, so it is not a subset.
                   Sealed habits are not listed separately: the tracker's per-day
                   dots already show which days were kept. */
                <HabitTracker currentDate={selectedDate} />
              )}
          </section>

          {/* ── GROUP: Routines ──
               A weekly recurring target. NOT the same thing as a habit (that is
               a streak) and NOT the same thing as a long-term destination. */}
          <section data-section="life.gold.routines" aria-labelledby="grp-routines" className="mt-4">
            <GroupHeader id="grp-routines" icon={<RefreshCw size={12} style={{ color: 'var(--page-accent)' }} aria-hidden />}
              title="Routines" count={activeRoutines.length} noun="routine" />
            {loading ? <GoalCardSkeleton />
              : error ? <GoalErrorState message={error} onRetry={() => loadGoals(selectedDate)} />
              : routineGoals.length === 0 ? (
                <WarmCard ambient>
                  <p className="text-[12px] text-zinc-400">
                    No routines yet. A routine repeats on a weekly cadence.
                  </p>
                </WarmCard>
              ) : (
                <div className="space-y-1.5">
                  {activeRoutines.map(goal => renderGoalCard(goal))}
                  <SealedList goals={completedRoutines} noun="routine" renderCard={renderGoalCard} />
                </div>
              )}
          </section>

          {/* ── GROUP: The Vault (long-term destinations) ──
               The ONLY place a `period:'longterm'` goal appears. */}
          <section data-section="life.gold.vault" aria-labelledby="grp-vault" className="mt-4">
            <GroupHeader id="grp-vault" icon={<Layers size={12} style={{ color: 'var(--page-accent)' }} aria-hidden />}
              /* Counts `longTermGoals`, NOT `vaultGoals`. The list below renders
                 from `longTermGoals`, so counting the partition bucket would put
                 a number on screen that the list below it could contradict. One
                 source, one number. */
              title="The Vault" count={longTermGoals.length} noun="destination" />
            <TheVault
              longTermGoals={longTermGoals}
              todayGoals={todayGoals}
              onSave={handleLTGSave}
              onDelete={handleLTGDelete}
            />
          </section>

          {/* Suggested goals — a review queue.
              These used to be filtered out with no way to reach them. Empty state
              says what WOULD be here rather than "No data" (P5). */}
          {suggestedGoals.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowSuggested(v => !v)}
                aria-expanded={showSuggested}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showSuggested ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Suggested ({suggestedGoals.length})
              </button>
              {showSuggested && (
                <div className="space-y-1.5 mt-2">
                  {suggestedGoals.map(goal => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-zinc-300 truncate">{goal.title}</p>
                        <p className="text-[10px] text-zinc-600 truncate">
                          {goal.category}{goal.deadline ? ` · due ${goal.deadline}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismissSuggested(goal)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptSuggested(goal)}
                        className="gap-1.5"
                        style={{
                          color: 'var(--page-accent)',
                          backgroundColor: 'color-mix(in srgb, var(--page-accent) 15%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--page-accent) 28%, transparent)',
                        }}
                      >
                        <CheckCircle2 size={12} aria-hidden />
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sealed dailies — same component as the other two groups, so the three
              disclosures behave identically instead of one working and two
              silently doing nothing. */}
          <SealedList goals={completedDailies} noun="goal" renderCard={renderGoalCard} />

          {/* AI Goal Coach */}
          <WarmCard ambient>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={13} className="text-[var(--color-violet-ink)]" />
              <span className="text-[13px] font-semibold text-zinc-200">AI Goal Coach</span>
            </div>
            <GoalAICoach onApply={async (proposal) => { await api.goalAiApplyProposal(proposal.goalId, proposal.newConfig || {}); loadGoals(selectedDate); }} onDismiss={() => {}} />
          </WarmCard>
        </div>
      </div>

      {/* ── Phases: NAVIGATION, not a second writer (spec §2.1) ──
          Phases live in River mode. `LensId` defaults to 'phases', so that is
          where they belong, and a second `PhaseFormDialog` here meant the user
          could create a phase from two surfaces and not know which was
          canonical. This card therefore creates NOTHING: it routes. */}
      <div className="mt-4">
          <WarmCard>
            <div className="flex items-center gap-1.5 mb-2">
              <Layers size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />
              <span className="text-[13px] font-semibold text-zinc-100">Phases</span>
            </div>
            <p className="text-[12px] text-zinc-400">
              Phases are chapters of your life — a job, a move, a project that spans
              months. They live in the River, where the whole timeline shows.
            </p>
            {onManagePhases && (
              <Button
                size="sm"
                variant="outline"
                onClick={onManagePhases}
                className="mt-3 gap-1.5"
                data-lifephase="manage-phases"
              >
                Manage phases
                <ChevronRight size={12} aria-hidden />
              </Button>
            )}
          </WarmCard>
        </div>

      {/* ── GROUP: weekly recap ──
           Fifth find.segment. Sits above the reflection card because the recap is
           the week's SCORE and the reflection is today's note — score first. */}
      <section data-section="life.gold.weekly" aria-labelledby="grp-weekly" className="mt-4">
        <GroupHeader id="grp-weekly" icon={<TrendingUp size={12} style={{ color: 'var(--page-accent)' }} aria-hidden />}
          title="Weekly recap" count={weekDates.length} noun="day" />
        <WarmCard>
          <WeekReview days={weekReviewDays} weekly={weekReviewInput} streak={covenantStreakDays} doneDates={doneDates} />
        </WarmCard>
      </section>

      {/* Daily reflection — today's note on the day itself. */}
      <section aria-label="Daily reflection">
        <ReflectionCard date={selectedDate} data={reflection} summary={reviewSummary} streak={covenantStreakDays}
          onSave={async s => { setReviewSummary(s); try { await api.saveGoalReview(selectedDate, s); } catch {} }} />
      </section>

      {/* Goal hub — everything serving one goal, in one place */}
      <ConnectionExplorer
        entity={hubEntity}
        isOpen={!!hubEntity}
        onClose={() => setHubEntity(null)}
      />
    </div>
  );
}
