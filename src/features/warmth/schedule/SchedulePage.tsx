// src/features/warmth/schedule/SchedulePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ActivitiesSheet } from './activities/ActivitiesSheet';
import { ScheduleLayoutShell } from './ScheduleLayoutShell';
import type { ViewMode } from './layout';
import { TodoList } from '../../../components/goals/TodoList';
import { ConnectionExplorer } from '../../../components/goals/ConnectionExplorer';
import { ScheduleCard } from '../../../pages/dashboard/ScheduleCard';
import { WeekBoard, weekDates } from './WeekBoard';
import { CalendarSidebar } from '../../../components/goals/CalendarSidebar';
import { DeadlinesCard } from '../../../components/dashboard/DeadlinesCard';
import { useFocusGoals } from '../../../hooks/useFocusGoals';
import type { CriteriaForm } from '../../../components/goals/CriteriaBuilder';
import type { Goal, LongTermGoal, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';
import { addDaysStr, mondayOf, daysUntil, todayStr, DAY_SHORT } from '@/lib/week';

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

/* ── WeekdayRail: the page's only "which day am I scheduling?" control ──
 *
 * WHY THIS EXISTS AT ALL. `schedule_entries.day_of_week` is a RECURRING WEEKDAY
 * (0–6) — every consumer in the repo filters `day_of_week === date.getDay()`
 * (ScheduleCard, DailyPlannerCard, ScheduleSyncCard, WidgetSummaries,
 * life-river/ScheduleTab). So a block is "every Tuesday, 14:00", NOT a dated
 * event. The old page hid that behind a `<select>` inside a form, which read as
 * "whatever day is currently selected" — i.e. locked.
 *
 * The fix is to make the weekday a first-class, clickable value with the day's
 * load visible, so choosing a target day is direct manipulation and the form
 * simply inherits it. A rail, not a dropdown: 7 targets, all shown, each
 * announcing how much is already on it.
 *
 * Shape taken from the shadcn `tabs` primitive (already installed and
 * re-skinned in src/components/ui/tabs.tsx — its TabsList is an inline-flex
 * track with `ring-1` + `p-0.5` + rounded-md cells). Re-skinned to LAMINAR:
 * the track is a muted surface, the selected cell is the page accent, radii are
 * 8px (sm slot), and the focus ring is `--page-accent`. Not `TabsTrigger`
 * directly because each cell also carries a count and needs real button
 * semantics, which the primitive's slots do not provide.
 */
function WeekdayRail({ selectedDay, onSelect, counts, todayDay }: {
  selectedDay: number; onSelect: (d: number) => void;
  counts: number[]; todayDay: number;
}) {
  return (
    <div
      role="group"
      aria-label="Day of week — pick the day you are scheduling"
      /* No ring, no fill. This is a tab strip, not a panel — giving it card
         chrome was one of five boxes on the page. A hairline under the active
         cell is the whole affordance. */
      className="grid grid-cols-7 gap-1 border-b border-[var(--color-border)] pb-1"
    >
      {DAY_LETTER.map((letter, i) => {
        const active = i === selectedDay;
        const n = counts[i] || 0;
        const isToday = i === todayDay;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={active}
            aria-label={`${DAY_SHORT[i]} — ${n} block${n === 1 ? '' : 's'}${isToday ? ', today' : ''}`}
            className={[
              'relative flex min-h-[44px] flex-col items-center justify-center rounded-md',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]',
              active
                ? 'text-[var(--color-foreground)] bg-[var(--color-muted-40)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-40)] hover:text-[var(--color-foreground)]',
            ].join(' ')}
            /* The active day is marked by a 2px accent rule, not a fill: on a
               strip with no track, an underline is what reads as "selected". */
            style={active ? { boxShadow: 'inset 0 -2px 0 0 var(--page-accent)' } : undefined}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider">{letter}</span>
            <span className={[
              'font-mono text-[13px] leading-tight tabular-nums',
              active ? 'text-[var(--page-accent)]' : n > 0 ? '' : 'text-[var(--color-muted-foreground)]/50',
            ].join(' ')}>
              {n > 0 ? n : '\u00b7'}
            </span>
            {/* Today is marked by a dot as well as by colour — meaning is never
                carried by hue alone (WCAG 1.4.1). */}
            {isToday && (
              <span
                aria-hidden
                className="absolute bottom-1 h-1 w-1 rounded-full"
                style={{ backgroundColor: 'var(--page-accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Masthead: page identity + the ONE date navigator ──
 *
 * Everything that moves `selectedDate` (the chevrons, "Today", the wall, the day
 * strip) is the same value reached different ways, so it is presented once here.
 * Blocks are weekday-recurring and are chosen on the rail instead — see the
 * WeekdayRail note for why those are two different selections.
 */
function DateNav({ selectedDate, onChange }: { selectedDate: string; onChange: (d: string) => void }) {
  const shift = (n: number) => onChange(addDaysStr(selectedDate, n));
  const isToday = selectedDate === todayStr();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label="Previous day"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted-60)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
      >
        <ChevronLeft size={15} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange(todayStr())}
        disabled={isToday}
        aria-label="Jump to today"
        className="h-8 min-w-[72px] rounded-lg px-2.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] disabled:cursor-default disabled:text-[var(--color-muted-foreground)]/50"
        style={isToday ? undefined : {
          color: 'var(--page-accent)',
          backgroundColor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
        }}
      >
        {isToday ? 'Today' : 'Jump to today'}
      </button>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label="Next day"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted-60)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
      >
        <ChevronRight size={15} aria-hidden />
      </button>
    </div>
  );
}

/* Error state per P5: plain cause + a recovery action, never a bare string.
   Only the ledger needs one — the field band delegates its loading/error to
   ScheduleCard, which ships both already. */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted-35)] px-5 py-6 text-center"
    >
      <p className="text-[12px]" style={{ color: 'var(--error)' }}>{message}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">RHEO could not load this section.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
        style={{
          color: 'var(--page-accent)',
          backgroundColor: 'color-mix(in srgb, var(--page-accent) 10%, transparent)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--page-accent) 28%, transparent)',
        }}
      >
        Retry loading open items
      </button>
    </div>
  );
}

/* ── ledger side toggle ──
 * SchedulePage keeps its OWN preference key. It previously shared
 * `gold_calendar_side` with the Gold tab, so moving the calendar on one tab
 * silently moved it on the other — two surfaces fighting over one value. */
type CalendarSide = 'left' | 'right';

function useCalendarSide(): [CalendarSide, () => void] {
  const [side, setSide] = useState<CalendarSide>('left');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const api = (window as any).deskflowAPI;
        if (!api?.getPreferences) return;
        const prefs = await api.getPreferences();
        const stored = prefs?.['schedule_calendar_side'];
        if (alive && stored?.schemaVersion === 1) {
          const v = stored.side;
          if (v === 'left' || v === 'right') setSide(v);
        }
      } catch { /* keep default */ }
    })();
    return () => { alive = false; };
  }, []);
  const toggle = useCallback(() => setSide(s => {
    const next = s === 'left' ? 'right' : 'left';
    try { (window as any).deskflowAPI?.setPreference?.('schedule_calendar_side', { schemaVersion: 1, side: next }); } catch { /* ignore */ }
    return next;
  }), []);
  return [side, toggle];
}

/* ═══════════════════ main component ═══════════════════ */

interface SchedulePageProps { embedded?: boolean; }

export function SchedulePage({ embedded }: SchedulePageProps) {
  const api = (window as any).deskflowAPI;
  const [side, toggleSide] = useCalendarSide();

  /* TWO selections, deliberately, because the data model has TWO kinds of date:
   *
   *  - `selectedDate`  a real calendar DATE (YYYY-MM-DD). Drives the 3D wall, the
   *    day strip, and every dated commitment (deadlines, reminders, todos).
   *  - `selectedDay`   a RECURRING WEEKDAY (0-6). Drives schedule blocks, which
   *    are stored as `day_of_week` and mean "every Tuesday, 14:00".
   *
   * The old page derived the weekday from selectedDate on every render and never
   * let it be changed independently, so the block form could only ever write the
   * weekday you happened to be looking at. `selectedDay` is now state, seeded
   * from the date and re-seeded whenever the date moves. */
  const [selectedDate, setSelectedDate] = useState(todayStr);
  /* Activities sheet visibility. Local, not persisted: the sheet is a
     transient surface, so reopening the page should always start closed. */
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  /* Calendar view mode for the layout shell's [Day|Week|Month] toggle (spec
     §55). Separate from `showWeekSchedule`, which is a DISPLAY choice inside
     the agenda panel, not a calendar view mode. */
  const [calendarView, setCalendarView] = useState<ViewMode>('week');
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; createdAt: string; goalId?: string; scheduleId?: string; deadlineId?: string; parentTodoId?: string; dueDate?: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWeekSchedule, setShowWeekSchedule] = useState(false);
  /* One page-level notice, not a form. The page no longer owns its own
     block/deadline forms — ScheduleCard and DeadlinesCard each already ship a
     complete one, and a third copy was the reason adding a block felt like it
     belonged to "the current day". What remains is a place to REPORT a failed
     write, which those inner forms cannot do for the handlers below. */
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [hubEntity, setHubEntity] = useState<{ type: 'goal' | 'habit'; id: string; title: string } | null>(null);
  /* Bumping this re-runs the load effect — it is the recovery action for the
     error state, so it MUST be declared before the effect that depends on it. */
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadAll = useCallback(() => setReloadNonce(n => n + 1), []);

  /* Selecting a column sets the DATE, and the weekday follows from it. The old
     strip set the date while the panel keyed off the weekday, so all seven
     buttons in a week resolved to the same result — which is why clicking them
     appeared to do nothing. One source of truth: the date. */
  const boardDates = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const handleBoardSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    const d = new Date(date + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) setSelectedDay(d.getDay());
  }, []);

  const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
  const { focusState, activeGoalIds } = useFocusGoals(goals);

  /* ── load ── */
  /* `todos` is not decoration: SchedulePage feeds it to the calendar, which
     draws a mark on any day a todo is due. TodoList owns its todos outright
     (it never lifted them), so without a way for it to say "I changed" this
     page's copy went stale on the first add and the calendar silently omitted
     the mark until something else happened to re-run the effect. Hence
     `onChanged={loadTodos}`. Same shape as the reminders/deadlines path, which
     already round-tripped through the parent's own state. */
  const loadTodos = useCallback(async () => {
    try {
      const res = await api.todoList?.();
      if (res?.success) setTodos(res.todos || []);
    } catch { /* non-critical: the task list renders its own state */ }
  }, [api]);

  const loadGoals = useCallback(async (_date: string) => {
    setLoading(true); setError(null);
    try {
      const res = await api.getGoalsBatch('2000-01-01', addDaysStr(todayStr(), 120));
      const map = new Map<string, any>();
      for (const d of (res.days || []) as any[]) { for (const g of (d.goals || []) as any[]) { if (!g.id) continue; map.set(g.id, g); } }
      setGoals([...map.values()]);
    } catch (e: any) { setError(e?.message || 'Failed to load goals'); } finally { setLoading(false); }
  }, [api]);

  /* Moving the date moves the weekday with it — one edit, one meaning. Picking a
     weekday on the rail deliberately does NOT move the date, because a block is
     recurring and a date is not. */
  useEffect(() => {
    setSelectedDay(new Date(selectedDate + 'T00:00:00').getDay());
  }, [selectedDate]);

  useEffect(() => {
    loadGoals(selectedDate);
    (async () => { try { const res = await api.getSchedule(); setSchedule(res.entries || []); } catch {} })();
    (async () => { try { const res = await api.getDeadlines({ days: 60 }); setDeadlines(res.deadlines || []); } catch {} })();
    (async () => { try { const res = await api.getReminders(); setReminders(res.reminders || []); } catch {} })();
    loadTodos();
    (async () => { try { const res = await api.getLongtermGoals(); setLongTermGoals(res.goals || []); } catch {} })();
    // Fetch week goals for CalendarStrip
    (async () => { try { const mon = mondayOf(selectedDate); const res = await api.getGoalsBatch(mon, addDaysStr(mon, 6)); setWeekGoals(res.days || {}); } catch { /* non-critical */ } })();
  }, [selectedDate, loadGoals, loadTodos, api, reloadNonce]);

  /* ── schedule CRUD ── */
  /* Returns a boolean so the caller (ScheduleCard's inline form) can keep its
     form open and surface the failure instead of closing optimistically. */
  const addScheduleEntry = async (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>): Promise<boolean> => {
    try {
      const res = await api.addScheduleEntry(entry);
      if (res?.success && res.id) {
        setSchedule(prev => [...prev, { ...entry, id: res.id, createdAt: new Date().toISOString() }]);
        setNotice(null);
        return true;
      }
      setNotice({ tone: 'error', text: res?.error
        ? `RHEO could not save this block because ${res.error}. Try again.`
        : 'RHEO could not save this block. Try again.' });
      return false;
    } catch {
      setNotice({ tone: 'error', text: 'RHEO could not reach the schedule store. Check the app is running, then try again.' });
      return false;
    }
  };
  const updateScheduleEntry = async (id: string, patch: Partial<ScheduleEntry>) => { setSchedule(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e))); try { await api.updateScheduleEntry(id, patch); } catch {} };
  const deleteScheduleEntry = async (id: string) => { setSchedule(prev => prev.filter(e => e.id !== id)); try { await api.deleteScheduleEntry(id); } catch {} };

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
      setNotice({ tone: 'error', text: 'RHEO could not mark this deadline complete. Try again.' });
    }
  };

  /* ── reminders ── */
  const handleToggleReminder = async (id: string, done: boolean) => { setReminders(prev => prev.map(r => (r.id === id ? { ...r, done } : r))); try { await api.toggleReminder?.(id, done); } catch {} };
  const handleDeleteReminder = async (id: string) => { setReminders(prev => prev.filter(r => r.id !== id)); try { await api.deleteReminder?.(id); } catch {} };

  /* ── derived ── */
  const todaySchedule = useMemo(() => schedule.filter(e => e && e.day_of_week != null), [schedule]);
  const doneCount = goals.filter(g => g.status === 'done').length;

  const goalOptions = useMemo(() => goals.map(g => ({ id: g.id, title: g.title, category: g.category })), [goals]);
  const deadlineOptions = useMemo(() => deadlines.map(d => ({ id: d.id, title: d.title, dueDate: d.due_date })), [deadlines]);
  const scheduleOptions = useMemo(() => schedule.map(e => ({ id: e.id, title: e.title, startTime: e.start_time, endTime: e.end_time })), [schedule]);

  /* Marks are drawn by CalendarStrip as small diamonds, so each has to carry a
     colour VALUE (not a class) — which rules out `ENTITY_COLORS` in
     src/lib/CategoryColors.ts, since that map stores Tailwind class strings. So
     the identities are taken from it and only the delivery changes: same
     entities, hue expressed as the token the app already publishes. Verified
     against the built stylesheet, which emits the full Tailwind default palette
     (217 `--color-*` custom properties), so these resolve instead of falling
     through to nothing.

     ENTITY_COLORS gives deadline=rose, goal=amber, todo=zinc. It has no
     `reminder`, and amber is already spoken for, so a reminder takes amber (a
     thing at a TIME — exactly what LAMINAR §2 reserves amber for) and a long-term
     goal takes violet. That last pairing is the one here NOT copied from
     ENTITY_COLORS: a second amber would make the two indistinguishable on a
     29-day strip, where telling them apart is the entire job. */
  const MARK_COLOR = {
    deadline: 'var(--color-rose-400)',
    reminder: 'var(--color-amber-400)',
    longTermGoal: 'var(--color-violet-400)',
    todo: 'var(--color-zinc-400)',
  } as const;

  const radarMarks = useMemo(() => {
    const m = new Map<string, { color: string; label: string }[]>();
    const push = (date: string, mark: { color: string; label: string }) => { if (!m.has(date)) m.set(date, []); m.get(date)!.push(mark); };
    deadlines.forEach(d => { if (d.due_date && d.status !== 'completed') push(d.due_date, { color: MARK_COLOR.deadline, label: d.title }); });
    reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: MARK_COLOR.reminder, label: r.text }); });
    longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: MARK_COLOR.longTermGoal, label: l.title }); });
    todos.forEach(t => { if (t.dueDate && !t.done) push(t.dueDate, { color: MARK_COLOR.todo, label: t.text }); });
    return m;
  }, [deadlines, reminders, longTermGoals, todos]);

  /* ── derived: what the page reads at a glance ── */
  /* How much is on each weekday. This is what makes the rail a control rather
     than decoration: you can see that Tuesday already has three things before
     you aim a new one at it. */
  const blockCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const e of schedule) {
      const d = e?.day_of_week;
      if (typeof d === 'number' && d >= 0 && d <= 6) counts[d] += 1;
    }
    return counts;
  }, [schedule]);

  const openTodos = useMemo(() => todos.filter(t => !t.done).length, [todos]);
  const dueSoon = useMemo(
    () => deadlines.filter(d => {
      if (d.status === 'completed') return false;
      const n = daysUntil(d.due_date);
      return n !== null && n <= 7;
    }).length,
    [deadlines],
  );

  /* ── render ── */
  return (
    <div className={embedded ? 'w-full h-full min-h-0 overflow-hidden' : 'w-full max-w-[1600px] mx-auto px-4 py-6 min-h-0'} style={embedded ? undefined : { height: 'calc(100vh - 2rem)' }}>

      {/* ═══ MASTHEAD ═══ identity + the one date navigator + focus ribbon ═══
          LAMINAR §2: one signal hue per surface, resolved from --page-accent
          (clay on the Life page). The file previously hardcoded pink-500 and the
          brand pink literal here and in five other places — a DIFFERENT hue from
          the page this component lives on, which is why the tab read as bolted
          on rather than native. */}
      <ActivitiesSheet open={activitiesOpen} onClose={() => setActivitiesOpen(false)} />

      {/* ═══ THE LAYOUT ═══
          This is the part that was MISSING. `ScheduleLayoutShell` existed and
          compiled, but nothing ever imported it, so the preset menu, the
          drag-to-swap, the per-panel hide toggle and the clamped resizer were
          all reachable code with zero entry points — the page rendered its own
          bespoke header + two hard-coded grids instead. The engine and the
          shell are now actually mounted, which is what makes the layout
          adjustable at all.

          The shell owns the header, so the bespoke one above it is gone rather
          than duplicated: two headers would have meant two different "today"
          buttons and two date navs. `renderPanel` is the only seam — it maps a
          panel id to the existing component that already renders it, so no data
          loading moved and no panel was rewritten. */}
      {/* A failed write has to SAY so. The handlers below set `notice`; without
          this the error is captured and thrown away, and a save that never
          landed then looks exactly like one that did. The old bespoke header
          rendered this — replacing the header dropped the render but kept the
          handlers, so the page went quiet about its own failures. */}
      {notice && (
        <div
          role="status"
          className={`flex shrink-0 items-start justify-between gap-3 rounded-lg border px-3 py-2 text-[12px] ${
            notice.tone === 'error'
              ? 'border-red-500/40 bg-red-500/5 text-red-500 light:bg-[var(--ws-surface-raised)]'
              : 'border-zinc-800/50 bg-zinc-900/40 text-[var(--color-muted-foreground)] light:bg-[var(--ws-surface-raised)]'
          }`}
        >
          <span className="min-w-0">{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      <ScheduleLayoutShell
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        view={calendarView}
        onViewChange={setCalendarView}
        isToday={selectedDate === todayStr()}
        renderPanel={(panel) => {
          switch (panel) {
            case 'calendar':
              return (
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
              );

            case 'agenda':
              return (
                <div className="space-y-3">
                  <WeekBoard
                    selectedDate={selectedDate}
                    onSelectDate={handleBoardSelectDate}
                    dates={boardDates}
                    schedule={schedule}
                    deadlines={deadlines}
                    reminders={reminders}
                    todos={todos.map(t => ({ id: t.id, text: t.text, done: t.done, dueDate: t.dueDate }))}
                    goals={goals}
                    loading={loading}
                    error={error}
                    onRetry={reloadAll}
                  />
                  <ScheduleCard
                    entries={todaySchedule}
                    selectedDate={selectedDate}
                    selectedDay={selectedDay}
                    onDayChange={setSelectedDay}
                    hideDaySelector
                    onAdd={addScheduleEntry}
                    onUpdate={updateScheduleEntry}
                    onDelete={deleteScheduleEntry}
                    linkedGoals={goalOptions}
                    showAll={showWeekSchedule}
                    loading={loading}
                    error={error}
                    onOpenGoalHub={gid => {
                      const g = goals.find(x => x.id === gid);
                      setHubEntity({ type: g?.isHabit ? 'habit' : 'goal', id: gid, title: g?.title || 'Goal' });
                    }}
                  />
                </div>
              );

            case 'upcoming':
              return loading ? (
                <div className="space-y-3" aria-hidden>
                  <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--color-muted)]" />
                  {[1, 2, 3].map(i => <div key={i} className="h-11 animate-pulse rounded-lg bg-[var(--color-muted)]" />)}
                </div>
              ) : error ? (
                <LoadError message={error} onRetry={reloadAll} />
              ) : (
                <DeadlinesCard
                  bare
                  deadlines={deadlines}
                  reminders={reminders}
                  loading={loading}
                  error={error}
                  onAdd={handleAddDeadline}
                  onDelete={handleDeleteDeadline}
                  onUpdate={handleUpdateDeadline}
                  onComplete={handleCompleteDeadline}
                  onToggleReminder={handleToggleReminder}
                  onDeleteReminder={handleDeleteReminder}
                  goalOptions={goalOptions}
                />
              );

            case 'todos':
              return (
                <TodoList
                  bare
                  onChanged={loadTodos}
                  goalOptions={goalOptions}
                  deadlineOptions={deadlineOptions}
                  scheduleOptions={scheduleOptions}
                />
              );

            default:
              return null;
          }
        }}
      />

      {/* Goal hub — a schedule block links to a goal, so the hub is reachable
          from here too, not only from Gold. */}
      <ConnectionExplorer
        entity={hubEntity}
        isOpen={!!hubEntity}
        onClose={() => setHubEntity(null)}
      />
    </div>
  );
}
