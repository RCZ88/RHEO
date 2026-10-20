// ============================================================
// DeskFlow — MonthWall (3D Month Calendar)
// Gold Page → Life Phases → Schedule section
// Single unified calendar: goals, deadlines, reminders, schedule
// LAMINAR: depth-as-brightness, gloss-as-behavior (moving specular)
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, X, CalendarDays, Sun,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';
import { Select, SelectItem } from '../ui/select';
import type { Goal, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';


const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STORAGE_KEY = 'df-monthwall-events';

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localDateKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return localDateKey(d);
}

export interface WallEvent {
  id: string;
  date: string;
  title: string;
  category: string;
  time?: string;
  source: 'manual' | 'goal' | 'deadline' | 'reminder' | 'schedule';
  createdAt: string;
}

export interface MonthWallProps {
  onMonthChange?: (month: string) => void;
  goals?: Goal[];
  deadlines?: Deadline[];
  reminders?: Reminder[];
  schedule?: ScheduleEntry[];
  longTermGoals?: import('../../../types/goals').LongTermGoal[];
  onAddGoal?: (title: string, dueDate?: string) => void;
  onAddReminder?: (text: string, dueDate?: string) => void;
  renderDay?: (dayData: { date: string; events: WallEvent[]; isToday: boolean; isPast: boolean }) => React.ReactNode;
  viewDate?: Date;
  selectedDate?: string;
  /** Fired when a day tile is picked. Optional and additive: the wall already
   *  *displayed* `selectedDate`, it just could never *report* a new one, so on a
   *  page whose whole job is "look at the month, then act on a day" the centrepiece
   *  was inert — you clicked a date and the page never moved. Callers that omit
   *  this (the Gold tab) behave exactly as before. */
  onDateChange?: (date: string) => void;
}

function loadEvents(): WallEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e && typeof e.title === 'string' && typeof e.date === 'string');
  } catch { return []; }
}

function saveEvents(events: WallEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch { /* silent */ }
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  /* A month that finishes inside its fifth week does not need a sixth EMPTY
     row. That row was ~17% of the wall's height, and at 1366x768 it is the
     difference between a month that fits its panel and one that reads as cut
     off (or scrolls, hiding the last week). */
  if (cells.length > 35 && cells.slice(-7).every(c => c === null)) cells.length = 35;
  return cells;
}

export function getEventsForDay(events: WallEvent[], date: string): WallEvent[] {
  return events.filter(e => e.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

/* Exported for testability only. This is the whole data path from the page's
   props to what the wall draws, and it is pure — so it is the one thing worth
   asserting on directly. The grid it feeds sits behind an effect-fed `loading`
   flag, which means a server render can never reach the cells; without this
   export "does the wall react to an addition?" is unanswerable without a build. */
export function deriveEvents(goals: Goal[], deadlines: Deadline[], reminders: Reminder[], schedule: ScheduleEntry[], longTermGoals: any[], viewDate?: Date): WallEvent[] {
  const viewYear = viewDate?.getFullYear() ?? new Date().getFullYear();
  const viewMonth = viewDate?.getMonth() ?? new Date().getMonth();
  const events: WallEvent[] = [];
  for (const g of goals) {
    const d = g.deadline || g.date;
    if (!d) continue;
    events.push({ id: `g-${g.id}`, date: localDateKeyFromDate(d), title: g.title, category: g.category || 'work', time: undefined, source: 'goal', createdAt: g.createdAt });
  }
  for (const d of deadlines) {
    if (!d.due_date || d.status === 'completed') continue;
    events.push({ id: `dl-${d.id}`, date: localDateKeyFromDate(d.due_date), title: d.title, category: 'work', time: undefined, source: 'deadline', createdAt: d.createdAt });
  }
  for (const r of reminders) {
    if (!r.due_date || r.done) continue;
    events.push({ id: `rm-${r.id}`, date: localDateKeyFromDate(r.due_date), title: r.text, category: 'personal', time: undefined, source: 'reminder', createdAt: r.created_at });
  }
  for (const s of schedule) {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const targetDayOfWeek = s.day_of_week;
    let day = firstDayOfMonth.getDay();
    let date = 1;
    while (day !== targetDayOfWeek) {
      date++;
      day = new Date(viewYear, viewMonth, date).getDay();
      if (date > 31) break;
    }
    if (date <= 31) {
      const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      events.push({ id: `sc-${s.id}`, date: d, title: `${s.title} ${s.start_time}-${s.end_time}`, category: s.category || 'work', time: s.start_time, source: 'schedule', createdAt: s.createdAt });
    }
  }
  for (const l of longTermGoals) {
    if (!l.deadline) continue;
    events.push({ id: `ltg-${l.id}`, date: localDateKeyFromDate(l.deadline), title: l.title, category: l.category || 'work', time: undefined, source: 'goal', createdAt: '' });
  }
  return events;
}

export function MonthWall({ onMonthChange, renderDay, goals = [], deadlines = [], reminders = [], schedule = [], longTermGoals = [], viewDate: viewDateProp, selectedDate, onDateChange }: MonthWallProps) {
  const [userEvents, setUserEvents] = useState<WallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (viewDateProp) return new Date(viewDateProp);
    if (selectedDate) return new Date(selectedDate + 'T00:00:00');
    return new Date();
  });
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', category: 'work', time: '' });
  const undoRef = useRef<WallEvent | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const wallRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 3D tilt — flat resting, drag-orbit earns tilt
  // Write transforms directly to DOM via refs+rAF so Vite never bundles
  // template literals as static strings.
  const [tiltX, setTiltX] = useState(4);
  const [tiltY, setTiltY] = useState(0);

  // reduced motion
  const reducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Derive real-data events every render
  const realEvents = useMemo(() => deriveEvents(goals, deadlines, reminders, schedule, longTermGoals, viewDate), [goals, deadlines, reminders, schedule, longTermGoals, viewDate]);

  // Sync viewDate when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      setViewDate(d);
    }
  }, [selectedDate]);

  // Merge real + user events (user events override same-source by id)
  const events = useMemo(() => {
    const map = new Map<string, WallEvent>();
    for (const e of realEvents) { if (!map.has(e.id)) map.set(e.id, e); }
    for (const e of userEvents) { map.set(e.id, e); }
    return Array.from(map.values());
  }, [realEvents, userEvents]);

  useEffect(() => {
    try { setUserEvents(loadEvents()); setError(null); } catch (e: any) { setError(e?.message || 'Could not load month events'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!undoId) return; const t = setTimeout(() => setUndoId(null), 5000); return () => clearTimeout(t); }, [undoId]);
  useEffect(() => { if (openDate) { const t = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(t); } }, [openDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  useEffect(() => { onMonthChange?.(`${year}-${String(month + 1).padStart(2, '0')}`); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayKey = localDateKey(new Date());

  const eventsByDate = useMemo(() => {
    const map: Record<string, WallEvent[]> = {};
    for (const e of events) { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return map;
  }, [events]);

  const nav = (dir: number) => setViewDate(new Date(year, month + dir, 1));
  const goToday = () => setViewDate(new Date());

  const addEvent = useCallback(() => {
    if (!openDate || !form.title.trim()) return;
    const ev: WallEvent = { id: crypto.randomUUID(), date: openDate, title: form.title.trim(), category: form.category || 'work', time: form.time || undefined, source: 'manual', createdAt: new Date().toISOString() };
    const next = [...userEvents, ev];
    setUserEvents(next);
    saveEvents(next);
    setForm({ title: '', category: 'work', time: '' });
    setOpenDate(null);
  }, [openDate, form, userEvents]);

  const deleteEvent = useCallback((id: string) => {
    const target = events.find(e => e.id === id);
    if (target) undoRef.current = target;
    setUndoId(id);
    const next = events.filter(e => e.id !== id);
    setUserEvents(next);
    saveEvents(next);
  }, [events]);

  const undoDelete = useCallback(() => {
    const target = undoRef.current;
    if (target) { const next = [...userEvents, target]; setUserEvents(next); saveEvents(next); }
    setUndoId(null);
    undoRef.current = null;
  }, [userEvents]);

  const openDay = (date: string) => {
    // Report the pick BEFORE opening the popover, so the surrounding page has
    // already re-rendered its day-scoped content by the time the panel appears.
    // The popover itself is wall-local (its events are a separate store), so this
    // is the only channel through which a day click can reach the page.
    onDateChange?.(date);
    setOpenDate(date);
    setForm({ title: '', category: 'work', time: '' });
  };
  const dayEvents = openDate ? getEventsForDay(events, openDate) : [];

  const hueFor = useCallback((category: string): string => {
    const style = getCategoryColor(category);
    const cls = style?.bg || style?.border || '';
    /* THE EVENT DOTS WERE NEVER DRAWN. `CategoryColors` stores TAILWIND CLASSES
       ("bg-violet-500/15"), and this value is written into
       `style={{ backgroundColor }}`. A class name is not a colour, so the
       declaration was invalid and dropped — every dot on the wall rendered with
       no fill, which is why a wall full of events looked empty. Invisible to
       `tsc`, to `esbuild`, and to a green build: it is a valid string.

       Take the hue out of the class and emit the palette token's 400 step — the
       same step `ENTITY_COLORS.bar` uses elsewhere, and one that clears 3:1 on
       both the raised and sunken tiles. The category→hue decision is unchanged:
       it still comes from CategoryColors (LAMINAR §5). Only the delivery is
       corrected. */
    const m = /-(violet|sky|pink|red|blue|fuchsia|emerald|cyan|amber|orange|rose|zinc|stone|yellow|indigo|teal|lime|slate|neutral)-/.exec(cls);
    return m ? `var(--color-${m[1]}-400)` : 'var(--color-muted-foreground)';
  }, []);

  /* ── NO 3D. There is no tilt state, no pointer-driven rotation and no
       flat/perspective toggle any more, and that is the point rather than a
       simplification.

       A rotated plane has no honest hit target. The eye aims at a skewed
       surface and the pointer disagrees, so `elementFromPoint` over the real
       geometry lands on a DIFFERENT day than the one under the cursor. That is
       not a styling bug — it is the arithmetic of rotateX/rotateY, and it is
       the whole reason "I can't click the calendar" survived several fixes that
       each looked correct. (It was made worse by `transformStyle: preserve-3d`,
       under which the browser sorts and hit-tests siblings in THREE dimensions,
       so a cell on a nearer Z plane swallowed the events aimed at the cell
       behind it.)

       Every affordance the tilt provided is now carried by the flat grid:
       depth became static per-row opacity, and the dot row + overflow count
       tell density at a glance. What is deliberately NOT carried over is the
       drama. This is a scheduling surface — reference, not delight (LAMINAR
       §6; apple-design §16 restraint). */

  const reactiveTransition = reducedMotion.current
    ? '0ms'
    : 'background-color 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms cubic-bezier(0.16,1,0.3,1)';
  // TODO(M-1): unify with app motion-preference

  const dots = dayEvents.slice(0, 2);
  const overflow = dayEvents.length - dots.length;
  const renderCell = (day: Date, key: string, isToday: boolean, isPast: boolean, list: WallEvent[]) => {
    if (renderDay) return renderDay({ date: key, events: list, isToday, isPast });
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => openDay(key)}
        className="relative aspect-square rounded-lg border flex flex-col items-center justify-center cursor-pointer"
        style={{ transition: reactiveTransition }}
        aria-label={day.toLocaleDateString()}
      >
        <span className={`text-[11px] leading-none tabular-nums ${isToday ? 'font-bold' : 'font-medium'}`}>{day.getDate()}</span>
        {list.length > 0 ? (
          <div className="flex items-center gap-0.5 mt-1">
            {dots.map(d => (
              <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
            ))}
            {overflow > 0 && <span className="text-[9px] leading-none text-zinc-500">+{overflow}</span>}
          </div>
        ) : (
          <span className="mt-1 h-1.5 w-1.5 rounded-full opacity-0 group-hover:opacity-60" style={{ backgroundColor: 'var(--page-accent)' }} />
        )}
      </motion.button>
    );
  };

  return (
    <div
      data-monthwall="wall"
      /* FILLS THE PANEL IT IS GIVEN. The wall used to size itself from its own
         content — square tiles whose height came from the width — so in the
         Today-first panel (797x403) six rows needed ~700px and the last four
         weeks fell below the fold. The spec asks for the opposite: "the
         calendar must work well when small ... show the month grid with dots
         only". A flex column with the month grid as the flexible child lets the
         rows share whatever height the panel has. */
      className="relative flex h-full min-h-0 flex-col overflow-y-auto ws-scroll rounded-xl border border-zinc-800/50 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] p-5"
      /* 20px of padding on every side was 40px of pure chrome above and below a
         month that has to fit a 227px wall at 1366x768. Inline so the value is
         honoured without depending on a new utility class being emitted. */
      style={{ padding: '4px 8px' }}

    >
      {/* ONE row of navigation. The wall used to print its own "Month Wall"
          title and an event caption directly beneath a panel header that
          already says "Calendar", then repeat the prev/next chevrons in a
          second row — 88px of chrome above a month grid that only had ~245px
          for six rows, so the last week fell below the panel. The title is the
          panel's job, so it is gone; Today joins the month nav; the arrows
          appear once. The colour legend went with it: 36px of labels for four
          dot hues, and it was the last 36px standing between six rows and the
          panel's height. The dots themselves remain on every cell. */}
      <nav aria-label="Month" className="mb-3 flex shrink-0 items-center gap-2" style={{ marginBottom: 4 }}>
        <button onClick={() => nav(-1)} aria-label="Previous month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">‹</button>
        <span className="text-[13px] font-semibold text-zinc-200 tabular-nums">{MONTHS[month]} {year}</span>
        <button onClick={() => nav(1)} aria-label="Next month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">›</button>
        <span className="flex-1" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={goToday}
          className="h-7 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 text-[11px] text-zinc-300 hover:text-white">
          Today
        </motion.button>
      </nav>

      {/* Weekday header */}
      {/* Same horizontal padding as the month grid below it (which is padded
          inline). Without it the letters were 10px left of their own columns
          and the drift grew to ~9px at the edges. Inline, not a new arbitrary
          class: this value must not depend on a rebuild emitting a new rule. */}
      <div className="grid grid-cols-7 gap-[10px] mb-1" style={{ paddingLeft: 4, paddingRight: 4, gap: 4 }}>
        {DAY_LETTER.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-zinc-600 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-1.5" data-monthwall-state="loading">
          <div className="grid grid-cols-7 gap-[10px]">{Array.from({ length: 42 }).map((_, i) => <div key={i} className="aspect-square rounded-lg bg-zinc-800/40" />)}</div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-10 text-center" data-monthwall-state="error">
          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-2"><CalendarDays size={22} className="text-zinc-600" /></div>
          <p className="text-[13px] font-medium text-zinc-400">Could not load month</p>
          <p className="text-[11px] text-zinc-600 mt-1 max-w-[240px]">{error}</p>
        </div>
      ) : (
        <div ref={wallRef} className="relative" aria-label="Month calendar">
          <div
            ref={containerRef}
            className="relative"
          >
            {/* FLAT, deliberately. This grid was `transformStyle: 'preserve-3d'`
                and every cell carried `translateZ(z)` + its own `zIndex`, under a
                scene rotated `rotateX(9deg) rotateY(7deg)`. In a preserve-3d
                context the browser sorts and HIT-TESTS siblings in three
                dimensions, so a cell on a nearer Z plane projects over — and
                swallows the pointer events for — the cell behind it. The result
                was a month wall that looked perfectly clickable (`cursor-pointer`
                on every cell, correct brightness, correct dots) and silently sent
                your click to a DIFFERENT date. "I can't click the calendar" is
                exactly what that looks like from the outside, and no amount of
                reading the JSX reveals it: the handler is wired, the colour is
                right, the number is right. Only `document.elementFromPoint` over
                the real geometry shows the hit landing on the wrong cell.

                The depth cue is NOT lost — it moves to `opacity`, which is applied
                per row as a STATIC value. Same read of "this row is nearer",
                computed once, with no geometry to mis-hit. `preserve-3d` on the
                OUTER wrapper is left alone; it only tilts the card, and it has no
                transformed descendants left to reorder. */}
            {/* Fits when it can, SCROLLS when it cannot. A 296px panel (Week
                first's bottom row) or a stacked 165px one cannot hold six
                readable rows plus the header/nav, and the wall's own
                `overflow-hidden` used to clip the rest of the month away with
                no scrollbar. `overflow-y-auto` makes the missing weeks
                reachable instead of invisible. */}
            <div className="grid min-h-0 flex-1 grid-cols-7 gap-[10px]" style={{ padding: 4, gap: 4, gridTemplateRows: `repeat(${Math.ceil(grid.length / 7)}, minmax(24px, 1fr))` }}>
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="min-h-0" />;
                const key = localDateKey(day);
                const isToday = key === todayKey;
                const isPast = key < todayKey;
                const row = Math.floor(idx / 7);
                const rowOffset = row - 2.5;
                const brightness = isPast ? 0.75 : isToday ? 1 : 0.55;
                const list = eventsByDate[key] || [];
                /* PER-DAY dots. These used to be read from the module-level
                   `dots`, which is derived from `openDate` — so every day cell
                   drew the marks belonging to whichever day happened to be open,
                   and drew NOTHING at all until you clicked one. The wall
                   therefore counted correctly (`+N`, and the caption in the
                   header) while mis-depicting the month, which is exactly the
                   "the calendar doesn't change when I add things" report.
                   Deriving them from this cell's own `list` is what the unused
                   `renderCell` above already did correctly. */
                const cellDots = list.slice(0, 2);
                const cellOverflow = list.length - cellDots.length;

                /* THE SELECTION WAS NEVER DRAWN. `selectedDate` was accepted as
                   a prop, handed to the component, and then not read anywhere in
                   the render — so clicking a day reported a new selection to the
                   page while the month looked identical. A control that changes
                   state in a place you cannot see is indistinguishable from a
                   control that does nothing, which is a third, independent
                   reason "clicking the calendar does nothing" kept coming back.

                   This is also the hinge the two views share: the month shows
                   which day is selected, and the week board beside it shows that
                   day's week. One value, two renderings, never disagreeing. */
                const isSelected = !!selectedDate && key === selectedDate;

                return (
                  <Popover key={key} open={openDate === key} onOpenChange={(o) => (o ? openDay(key) : setOpenDate(null))}>
                    <PopoverTrigger asChild>
                      <div
                        style={{
                          // Static per-row depth. Opacity, not translateZ: it keeps
                          // the "nearer row reads stronger" cue that the 3D used to
                          // give, while leaving the cell in normal 2D flow so a
                          // pointer event lands on the cell you actually aimed at.
                          opacity: 1 - Math.abs(rowOffset) * 0.055,
                          transition: reactiveTransition,
                        }}
                        className={`min-h-0 rounded-lg border cursor-pointer relative
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background)]
                          ${isSelected
                            ? 'ring-2 ring-[var(--page-accent)] border-transparent z-10'
                            : isToday ? 'border-zinc-700/60' : isPast ? 'border-zinc-800/50' : 'border-zinc-800/40'}`}
                      >
                        <div className="relative h-full rounded-lg flex flex-col items-center justify-center p-1"
                          style={{
                            background: isPast ? 'var(--color-card)' : 'var(--color-background)',
                          }}>
                          <span className={`text-[11px] leading-none tabular-nums ${isSelected ? 'font-bold text-[var(--page-accent)]' : isToday ? 'font-bold text-zinc-100' : isPast ? 'text-zinc-500' : 'text-zinc-400'}`}>{day.getDate()}</span>
                          {list.length > 0 ? (
                            <div className="flex items-center gap-0.5 mt-0.5 flex-wrap justify-center">
                              {cellDots.map(d => (
                                <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
                              ))}
                              {cellOverflow > 0 && <span className="text-[8px] text-zinc-500">+{cellOverflow}</span>}
                            </div>
                          ) : (
                            <span className="mt-0.5 h-1 w-1 rounded-full opacity-0 group-hover:opacity-40" style={{ backgroundColor: 'var(--page-accent)' }} />
                          )}
                        </div>
                        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'var(--hairline)' }} />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border-zinc-800 text-zinc-200">
                      <DayPanel date={day} events={getEventsForDay(events, key)} hueFor={hueFor} form={form} setForm={setForm} onSave={addEvent} onDelete={deleteEvent} inputRef={inputRef} />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty CTA */}
      {!loading && !error && events.length === 0 && (
        <div className="mt-3 flex justify-center">
          <button onClick={() => openDay(todayKey)} className="px-3 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors text-[11px] font-medium flex items-center gap-1">
            <Plus size={11} /> Add today's event
          </button>
        </div>
      )}

      {/* Undo pill */}
      <AnimatePresence>
        {undoId && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700">
            <span className="text-[11px] text-zinc-300">Event deleted</span>
            <button onClick={undoDelete} className="text-[11px] font-medium text-zinc-200 hover:text-white">Undo</button>
            <button onClick={() => setUndoId(null)} className="text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Day popover panel ── */
interface DayPanelProps {
  date: Date;
  events: WallEvent[];
  hueFor: (cat: string) => string;
  form: { title: string; category: string; time: string };
  setForm: (f: any) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function DayPanel({ date, events, hueFor, form, setForm, onSave, onDelete, inputRef }: DayPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const monthName = MONTHS[date.getMonth()];
  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });
  const categoryKeys = Object.keys(CATEGORY_COLORS as Record<string, string>);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-zinc-100">{dayName}</p>
          <p className="text-[11px] text-zinc-500">{monthName} {date.getDate()}</p>
        </div>
        {events.length > 0 && <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded-lg">{events.length} event{events.length > 1 ? 's' : ''}</span>}
      </div>
      {events.length === 0 ? (
        <div className="py-2 flex items-center justify-center"><div className="flex items-center gap-1.5 text-zinc-600 text-[11px]"><Sun size={12} /> No events — add one below</div></div>
      ) : (
        <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className="group flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800/60">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hueFor(e.category) }} />
              <span className="flex-1 min-w-0"><span className="block text-[12px] text-zinc-200 truncate">{e.title}</span>
                <span className="text-[9px] text-zinc-500 uppercase">{e.source}</span>
                {e.time && <span className="block text-[10px] text-zinc-500 font-mono">{e.time}</span>}
              </span>
              <button onClick={() => { if (deletingId === e.id) { onDelete(e.id); setDeletingId(null); } else { setDeletingId(e.id); setTimeout(() => setDeletingId(p => p === e.id ? null : p), 3000); } }}
                className={`w-6 h-6 rounded flex items-center justify-center ${deletingId === e.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800/50 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100'}`} aria-label={`Delete ${e.title}`}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="pt-2 border-t border-zinc-800/60 space-y-2">
        <input ref={inputRef} value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') onSave(); }} placeholder="Event title" className="w-full h-8 px-2 rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 focus:border-zinc-600 outline-none text-[12px] text-zinc-200 placeholder:text-zinc-600" />
        <div className="flex items-center gap-2">
          <Select value={form.category} onValueChange={(v: any) => setForm((p: any) => ({ ...p, category: v }))} className="flex-1 h-8">
            {categoryKeys.map(cat => <SelectItem key={cat} value={cat}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: hueFor(cat) }} />{cat}</span></SelectItem>)}
          </Select>
          <input type="time" value={form.time || ''} onChange={e => setForm((p: any) => ({ ...p, time: e.target.value }))} className="h-8 px-2 rounded-lg bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 outline-none text-[11px] text-zinc-300 w-[72px]" aria-label="Event time (optional)" />
        </div>
        <button onClick={onSave} disabled={!form.title.trim()} className="w-full h-8 rounded-lg flex items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-40 bg-zinc-800 light:bg-zinc-200 text-zinc-200 light:text-zinc-900 border border-zinc-700 light:border-zinc-300 hover:border-zinc-600 light:hover:border-zinc-400">
          <Plus size={12} /> Add event
        </button>
      </div>
    </div>
  );
}
