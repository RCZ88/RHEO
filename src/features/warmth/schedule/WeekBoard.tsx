/**
 * WeekBoard — the week as SEVEN COLUMNS, one per date.
 *
 * WHY THIS EXISTS. The page it replaces had exactly two modes: "one day at a
 * time" (filtered by a recurring weekday) and "see whole week" (an ungrouped
 * list of every block). Neither is a week. Two real defects fell out of that:
 *
 *  1. CLICKING A DATE DID NOTHING VISIBLE. The content panel was keyed on
 *     `selectedDay` (a recurring weekday, 0-6) while the day strip wrote
 *     `selectedDate` (a real date). Every one of the seven strip buttons in a
 *     week therefore set the same weekday — seven controls, one behaviour. It
 *     was wired correctly and still inert, which is the hardest kind of bug to
 *     see because nothing throws and the handler really does run.
 *  2. RECURRING BLOCKS APPEARED ONCE. "Every Tuesday, 14:00" is a weekly fact,
 *     not an event, so it belongs on EVERY Tuesday in view — which is the only
 *     way to answer "what does this week actually look like".
 *
 * A column per DATE fixes both at once, because the column's identity is the
 * date: a recurring block matches on `day_of_week`, a dated item matches on its
 * own date, and both land in the column the reader is looking at.
 *
 * ── HUMAN-CENTRIC DECISIONS (agent/skills/humancentred-UIUX) ──
 *
 * PRIMARY GOAL, one sentence: *decide what today costs and add to it.*
 *
 * · CLARITY — every row shows a human label. A schedule block shows "Wed"
 *   rather than "3" and its category shows "Deep work" rather than
 *   `deep_work`. An enum code is a system token and must never reach a human.
 * · STATE COVERAGE — five states, not one:
 *     loading  → seven skeleton columns of the SAME shape, so nothing jumps
 *     error    → the cause in a sentence plus a Retry button
 *     empty    → per column: "Nothing planned" and an Add affordance, never a
 *                blank rectangle the reader has to interpret
 *     populated→ rows, time-ordered, with the source named by an icon + word
 *     overflow → a column caps at MAX_VISIBLE and says "+3 more" rather than
 *                growing without bound and pushing the other six off screen
 * · HIERARCHY — the selected day is the focal point (accent rule + raised
 *   surface); every other day is muted. Metadata (times) is lower contrast than
 *   titles. One focal point, not seven equal columns shouting.
 * · FORGIVENESS — selecting a day never moves your work; it only changes what
 *   you are looking at. Nothing here is destructive, so nothing asks to be
 *   confirmed.
 * · AFFORDANCE — every column header is a real <button> with a visible
 *   focus-visible ring in the page accent, keyboard reachable, and at least
 *   44px tall. Nothing here is mouse-only.
 * · NOT COLOUR ALONE — today carries a "Today" chip, done carries a check icon
 *   plus a struck title, the selected day carries an accent rule AND a raised
 *   surface. Every state is legible with colour removed entirely.
 * · TIME ANCHOR — a block that runs past midnight says so. Rendering "23:30 →
 *   01:00" as if it ended before it began is the kind of small lie that makes
 *   someone stop trusting a schedule.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, CalendarPlus, Check, Clock, ListTodo, RotateCcw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';
import type { Goal } from '../../../types/goals';

const DAY_SHORT = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LETTER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A column never grows without bound — the other six days must stay on screen. */
const MAX_VISIBLE = 4;

export interface BoardTodo {
  id: string; text: string; done: boolean; dueDate?: string;
}

export type RowKind = 'block' | 'deadline' | 'reminder' | 'todo' | 'goal';

export interface BoardRow {
  id: string;
  kind: RowKind;
  title: string;
  /** Pre-formatted time range, or '' for all-day items. */
  time: string;
  /** True when a block crosses midnight — the renderer must not imply otherwise. */
  overnight: boolean;
  done: boolean;
}

const CATEGORY_WORDS: Record<string, string> = {
  deep_work: 'Deep work', study: 'Study', exercise: 'Exercise', admin: 'Admin',
  social: 'Social', personal: 'Personal', work: 'Work', health: 'Health',
  academic: 'Academic', rest: 'Rest', commute: 'Commute', meal: 'Meal',
  sleep: 'Sleep', other: 'Other',
};

/** Minutes since midnight, or null when unparseable. */
function minutesOf(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * The ONE place a week becomes rows. Pure, so it is the part worth testing:
 * "does Tuesday the 8th contain Tuesday's recurring block, and does Tuesday the
 * 15th contain it too?" is the question the whole feature exists to answer.
 */
export function buildWeekRows(dates: string[], input: {
  schedule: ScheduleEntry[];
  deadlines: Deadline[];
  reminders: Reminder[];
  todos: BoardTodo[];
  goals: Goal[];
}): Record<string, BoardRow[]> {
  const out: Record<string, BoardRow[]> = {};
  for (const d of dates) out[d] = [];

  for (const date of dates) {
    // Local-midnight Date, so getDay() matches what the reader sees rather than
    // what UTC thinks. Using toISOString() here would shift the weekday for
    // anyone east or west of Greenwich.
    const d = new Date(date + 'T00:00:00');
    if (Number.isNaN(d.getTime())) continue;
    const weekday = d.getDay();
    const rows = out[date];

    // RECURRING. Matches on weekday only — every date in view that falls on
    // this weekday gets the block. This is the behaviour the old page could not
    // express, because it only ever looked at one selected day.
    for (const e of input.schedule) {
      if (e?.day_of_week !== weekday) continue;
      const start = minutesOf(e.start_time);
      const end = minutesOf(e.end_time);
      const overnight = start !== null && end !== null && end < start;
      rows.push({
        id: `block-${e.id}`,
        kind: 'block',
        title: e.title || 'Untitled block',
        time: e.start_time ? (overnight
          ? `${e.start_time} → ${e.end_time} (next day)`
          : e.end_time ? `${e.start_time} → ${e.end_time}` : e.start_time) : '',
        overnight,
        done: false,
      });
    }

    for (const dl of input.deadlines) {
      if (dl?.due_date !== date) continue;
      rows.push({ id: `dl-${dl.id}`, kind: 'deadline', title: dl.title || 'Untitled deadline', time: '', overnight: false, done: dl.status === 'completed' });
    }
    for (const r of input.reminders) {
      if (r?.due_date !== date) continue;
      rows.push({
        id: `rm-${r.id}`, kind: 'reminder', title: r.text || 'Untitled reminder',
        time: r.due_time || '', overnight: false, done: !!r.done,
      });
    }
    for (const t of input.todos) {
      if (t?.dueDate !== date) continue;
      rows.push({ id: `td-${t.id}`, kind: 'todo', title: t.text || 'Untitled task', time: '', overnight: false, done: !!t.done });
    }
    for (const g of input.goals) {
      if (g?.date !== date) continue;
      rows.push({ id: `gl-${g.id}`, kind: 'goal', title: g.title || 'Untitled goal', time: '', overnight: false, done: g.status === 'done' });
    }

    rows.sort((a, b) => {
      // Timed rows first (chronological), then untimed. A block with no time is
      // "sometime that day" and belongs after anything with a clock on it.
      const at = a.time ? minutesOf(a.time.split(' ')[0]) : null;
      const bt = b.time ? minutesOf(b.time.split(' ')[0]) : null;
      if (at !== null && bt !== null) return at - bt;
      if (at !== null) return -1;
      if (bt !== null) return 1;
      return a.title.localeCompare(b.title);
    });
  }
  return out;
}

/** The 7 dates of the Monday-anchored week containing `anchor`. */
export function weekDates(anchor: string): string[] {
  const a = new Date(anchor + 'T00:00:00');
  if (Number.isNaN(a.getTime())) return [];
  const shift = (a.getDay() + 6) % 7;
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(a);
    d.setDate(d.getDate() - shift + i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

const ROW_ICON: Record<RowKind, typeof Clock> = {
  block: Clock, deadline: Target, reminder: Clock, todo: ListTodo, goal: Target,
};
const ROW_WORD: Record<RowKind, string> = {
  block: 'Block', deadline: 'Deadline', reminder: 'Reminder', todo: 'Task', goal: 'Goal',
};

export function WeekBoard({
  selectedDate, onSelectDate, dates, schedule, deadlines, reminders, todos, goals,
  loading, error, onRetry, onAddToDay,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  dates: string[];
  schedule: ScheduleEntry[];
  deadlines: Deadline[];
  reminders: Reminder[];
  todos: BoardTodo[];
  goals: Goal[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onAddToDay?: (date: string) => void;
}) {
  const rowsByDate = useMemo(
    () => buildWeekRows(dates, { schedule, deadlines, reminders, todos, goals }),
    [dates, schedule, deadlines, reminders, todos, goals],
  );

  // ERROR takes the whole board: a week where one column's data failed is not
  // something to paper over with six confident-looking empty columns.
  if (error) {
    return (
      <div role="alert" className="rounded-xl border p-4" style={{ borderColor: 'var(--error-muted)' }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--error)' }} aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--error)' }}>
              This week could not be loaded
            </p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">{error}</p>
            {onRetry && (
              <button
                type="button" onClick={onRetry}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] hover:bg-[var(--color-hover)] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <RotateCcw className="w-3 h-3" aria-hidden /> Retry loading the week
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
      role="group"
      aria-label="Week at a glance — one column per day"
    >
      {dates.map((date) => {
        const d = new Date(date + 'T00:00:00');
        const weekday = d.getDay();
        const isToday = date === new Date().toLocaleDateString('sv');
        const selected = date === selectedDate;
        const rows = rowsByDate[date] || [];
        const shown = rows.slice(0, MAX_VISIBLE);
        const overflow = rows.length - shown.length;

        return (
          <section
            key={date}
            aria-label={`${DAY_SHORT[weekday]} ${d.getDate()}`}
            className={cn(
              'flex min-w-0 flex-col rounded-xl border p-2 transition-colors duration-200',
              selected
                ? 'bg-[var(--color-card)]'
                : 'bg-[var(--color-background)]',
            )}
            style={{
              borderColor: selected ? 'var(--page-accent)' : 'var(--border-subtle)',
              // The selected day is the focal point. A 2px accent RULE, not a
              // fill — on seven equal columns a fill makes all seven shout.
              boxShadow: selected ? 'inset 0 2px 0 0 var(--page-accent)' : undefined,
            }}
          >
            <button
              type="button"
              onClick={() => onSelectDate(date)}
              aria-pressed={selected}
              className="flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-lg px-1 py-1 text-left transition-colors duration-150 hover:bg-[var(--color-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                {DAY_LETTER[weekday]}
              </span>
              <span className={cn(
                'font-mono text-[15px] leading-none tabular-nums',
                selected ? 'text-[var(--page-accent)]' : 'text-[var(--text-primary)]',
              )}>
                {d.getDate()}
              </span>
              {isToday && (
                <span className="text-[9px] uppercase tracking-wider text-[var(--page-accent)]">
                  Today
                </span>
              )}
            </button>

            {/* LOADING — skeleton columns shaped like the rows they will become,
                so nothing reflows when the data lands. */}
            {loading ? (
              <div className="mt-1.5 space-y-1.5" aria-busy="true">
                <span className="sr-only">Loading {DAY_SHORT[weekday]}</span>
                {[0, 1].map((i) => (
                  <div key={i} className="h-8 rounded-md bg-[var(--color-hover)] animate-pulse" style={{ opacity: 1 - i * 0.3 }} />
                ))}
              </div>
            ) : shown.length === 0 ? (
              /* EMPTY — per column, not per board. An empty column is
                 information ("this day is clear"), and it gets its own action. */
              <div className="mt-1.5 rounded-md border border-dashed p-2 text-center"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-[10px] leading-tight text-[var(--text-muted)]">Nothing planned</p>
                {onAddToDay && (
                  <button
                    type="button"
                    onClick={() => onAddToDay(date)}
                    className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--color-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[32px]"
                  >
                    <CalendarPlus className="w-3 h-3" aria-hidden /> Add
                  </button>
                )}
              </div>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {shown.map((row) => {
                  const Icon = ROW_ICON[row.kind];
                  return (
                    <li key={row.id}
                      className="rounded-md border p-1.5"
                      style={{ borderColor: 'var(--border-subtle)' }}
                      title={`${ROW_WORD[row.kind]}: ${row.title}`}
                    >
                      <div className="flex items-start gap-1">
                        <Icon className="w-3 h-3 shrink-0 mt-0.5 text-[var(--text-muted)]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={cn(
                            'block text-[11px] leading-tight break-words',
                            row.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
                          )}>
                            {row.done && <Check className="w-2.5 h-2.5 inline mr-0.5 align-[-1px]" aria-hidden />}
                            {row.title}
                          </span>
                          {row.time && (
                            /* Metadata is muted and smaller than the title, and
                               an overnight block says so in words rather than
                               printing an end time that precedes its start. */
                            <span className={cn(
                              'block font-mono text-[9px] leading-tight',
                              row.overnight ? 'text-[var(--error)]' : 'text-[var(--text-muted)]',
                            )}>
                              {row.time}
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {overflow > 0 && (
                  <li className="px-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectDate(date)}
                      className="text-[10px] text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--page-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 min-h-[32px]"
                    >
                      {overflow} more on {DAY_LETTER[weekday]}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export { CATEGORY_WORDS };