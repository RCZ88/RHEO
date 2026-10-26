import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Bell, Check, RotateCcw, Timer, X } from 'lucide-react';

/**
 * THE SCHEDULE PAGE — `HALO_RESULT.md` §4.5, §4.6, §7.4-7.7.
 *
 * The owner's complaint, verbatim: "it only shows 1 schedule deadline ... so make sure that to add
 * those" and "there's dead space on the right side". The page therefore has THREE pinned regions,
 * left to right:
 *
 *   NEXT/NOW   the nearest class block, pinned. It does not scroll away with the deadlines.
 *   LIST       every open deadline, TWO rows visible at every preset, scroll-snap inside itself.
 *   ACTIONS    two 44px buttons that act on the row you are looking at (bell, timer).
 *
 * WHY THE ROW HEIGHT IS `(rowHeight - 4) / 2` AND NOT A MIN-HEIGHT. The expanded surface is a
 * fixed preset (134px at Medium), so a page may never grow. The list is exactly one content row
 * tall and shows exactly two of its rows; everything else scrolls INSIDE it. That is the proof
 * that adding a tenth deadline cannot move the tab rail.
 *
 * WHY THE ROWS ARE NOT BUTTONS. A 22-30px row is below the 44px pointer target. The rows are
 * display-only options; the two 44px buttons on the right act on the current one. That is the
 * design's ruling (§10, "Interactive 22px rows").
 */

export interface HaloLifeAlarm {
  /** Only present on rows read from `deadline_reminders`; the legacy fallback has no id. */
  id?: string;
  mode: 'relative' | 'absolute';
  leadMin: number;
  atMs: number | null;
  fired: boolean;
}

export interface HaloLifeDeadline {
  id: string;
  title: string;
  dueAtMs: number | null;
  deltaMs: number | null;
  isOverdue: boolean | null;
  /** The legacy single column. Used ONLY when `alarms` is empty. */
  remindAtMs: number | null;
  alarms?: HaloLifeAlarm[];
}

export interface HaloLifeSchedule {
  id: string;
  title: string;
  location: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  category: string | null;
  startsAtMs: number;
  endsAtMs: number;
  isNow: boolean;
}

export interface HaloLifePayload {
  ok: boolean;
  now: number;
  schedule: HaloLifeSchedule | null;
  deadlines: HaloLifeDeadline[];
  error?: string;
}

/* ── FORMATTING — the tables in §7.4 and §7.5, not "something close" ─────────────────────── */

const MONO = 'var(--font-mono, ui-monospace, monospace)';
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole days from today. 0 = today, 1 = tomorrow, negative = past. */
function dayOffset(ms: number, now: number): number {
  return Math.round((startOfDay(ms) - startOfDay(now)) / 86_400_000);
}

/** `HH:MM` from a stored time that may be `HH:MM`, `HH:MM:SS` or `HH:MM:SS.sss`. The third line
 *  of the left block prints this, and a raw `09:20:00` reads as a timestamp, not a timetable. */
function hhmm(value: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(value ?? '');
}

function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `Wed 09:20` this week; `Tue 27 Oct 09:20` when it is a week or more away (§7.4). */
export function formatBlockWhen(s: HaloLifeSchedule, now: number): string {
  const day = WEEKDAY[new Date(s.startsAtMs).getDay()] ?? '';
  if (dayOffset(s.startsAtMs, now) >= 7) {
    const d = new Date(s.startsAtMs);
    return `${day} ${d.getDate()} ${MONTH[d.getMonth()]} ${hhmm(s.startTime)}`.trim();
  }
  return `${day} ${hhmm(s.startTime)}`.trim();
}

/** `in 42m` / `in 10h` / `in 3d` — the nearest block's countdown. Minutes under an hour, hours
 *  under a day, whole days after that. `in 0h` for a block 40 minutes away is a false reading. */
export function formatIn(deltaMs: number): string {
  const mins = Math.round(Math.abs(deltaMs) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${Math.max(1, hours)}h`;
  return `in ${Math.max(1, Math.round(hours / 24))}d`;
}

/** §7.5. `null` is "no date", never "today": the due date is genuinely absent. */
export function formatDeadlineDue(deltaMs: number | null | undefined): string {
  if (deltaMs == null || !Number.isFinite(deltaMs)) return 'no date';
  const abs = Math.abs(deltaMs);
  const mins = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);
  if (deltaMs < 0) {
    if (mins < 60) return `${Math.max(1, mins)}m overdue`;
    if (hours < 24) return `${hours}h overdue`;
    return `${Math.max(1, days)}d overdue`;
  }
  if (mins < 1) return 'due now';
  if (mins < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.max(1, days)}d`;
}

/** §7.6 — a relative alarm's label. No clock time is invented: the row knows `lead_min`, not a
 *  time-of-day, and the two places that already guess a time-of-day disagree. */
export function formatLead(leadMin: number): string {
  const m = Math.max(0, Math.round(leadMin));
  if (!m) return 'on time';
  if (m < 60) return `${m}m before`;
  if (m % 1440 === 0) return `${m / 1440}d before`;
  if (m % 60 === 0) return `${m / 60}h before`;
  return `${Math.floor(m / 60)}h ${m % 60}m before`;
}

/** §7.6 — an absolute alarm: `19:00` today, `Tue 19:00` within a week, `21 Oct` beyond. */
function formatAbsolute(ms: number, now: number): string {
  const d = new Date(ms);
  const days = dayOffset(ms, now);
  if (days === 0) return clockOf(ms);
  if (days > 0 && days < 7) return `${WEEKDAY[d.getDay()]} ${clockOf(ms)}`;
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** The alarm a row prints: the soonest PENDING one, else the most recent fired one, else the
 *  legacy column. `null` = no alarm was ever set, and the row shows no chip at all. */
export function pickAlarm(
  d: HaloLifeDeadline,
  now: number,
): { label: string; title: string; fired: boolean; count: number } | null {
  const alarms = Array.isArray(d.alarms) ? d.alarms : [];
  const pending = alarms.filter((a) => !a.fired);
  const pool = pending.length ? pending : alarms;
  let chosen: HaloLifeAlarm | null = null;
  let moment = Number.POSITIVE_INFINITY;
  for (const a of pool) {
    /* Relative: the moment is due-minus-lead, so the LARGEST lead is the earliest alarm. */
    const at = a.mode === 'absolute' && a.atMs != null ? a.atMs : (d.dueAtMs ?? 0) - a.leadMin * 60_000;
    if (at < moment) {
      moment = at;
      chosen = a;
    }
  }
  if (chosen) {
    const label =
      chosen.mode === 'absolute' && chosen.atMs != null
        ? formatAbsolute(chosen.atMs, now)
        : formatLead(chosen.leadMin);
    const state = chosen.fired ? 'Alarm sent' : 'Alarm set';
    /* `formatLead` already ends in "before"; appending it again produced "1d before before
     * the deadline" in the tooltip. */
    return {
      label,
      title: `${state}: ${label}`,
      fired: chosen.fired,
      count: alarms.length,
    };
  }
  if (d.remindAtMs != null) {
    const label = formatAbsolute(d.remindAtMs, now);
    return { label, title: `Alarm set: ${label}`, fired: false, count: 1 };
  }
  return null;
}

/** §7.5 ORDER: overdue first, LEAST overdue first (the thing you slipped on most recently is the
 *  most recoverable), then upcoming soonest first, then rows with no due date. */
export function sortDeadlines(list: HaloLifeDeadline[]): HaloLifeDeadline[] {
  return [...list].sort((a, b) => {
    const aDue = a.dueAtMs;
    const bDue = b.dueAtMs;
    if (aDue == null && bDue == null) return (a.title || '').localeCompare(b.title || '');
    if (aDue == null) return 1;
    if (bDue == null) return -1;
    const aOver = a.isOverdue === true;
    const bOver = b.isOverdue === true;
    if (aOver && !bOver) return -1;
    if (bOver && !aOver) return 1;
    /* Both overdue: ascending due would put the OLDEST first. Descending is "least overdue". */
    return aOver ? bDue - aDue : aDue - bDue;
  });
}

function formatElapsed(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ── SMALL PIECES ───────────────────────────────────────────────────────────────────────── */

const EYEBROW: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-eyebrow, 11px)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--halo-dim)',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const LABEL: CSSProperties = {
  fontFamily: MONO,
  fontSize: 'var(--halo-t-label, 11px)',
  color: 'var(--halo-dim)',
  whiteSpace: 'nowrap',
};

const QUICK: CSSProperties = {
  height: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid var(--halo-border)',
  background: 'transparent',
  color: 'var(--halo-text)',
  fontSize: 'var(--halo-t-value, 13px)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

function IconBtn({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${pressed ? 'var(--halo-text)' : 'var(--halo-border)'}`,
        background: pressed ? 'var(--halo-tab)' : 'transparent',
        color: pressed ? 'var(--halo-text)' : 'var(--halo-muted)',
        cursor: 'pointer',
        transition: 'background 150ms var(--halo-ease), border-color 150ms var(--halo-ease)',
      }}
    >
      {children}
    </button>
  );
}

function AlarmChip({ alarm }: { alarm: ReturnType<typeof pickAlarm> }) {
  if (!alarm) return null;
  return (
    <span
      className="halo-sched-alarm"
      title={alarm.title}
      data-halo-alarm={alarm.fired ? 'fired' : 'pending'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        color: alarm.fired ? 'var(--halo-dim)' : 'var(--halo-muted)',
      }}
    >
      <Bell size={11} strokeWidth={2} aria-hidden="true" />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 'var(--halo-t-label, 11px)',
          textDecoration: alarm.fired ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {alarm.label}
        {alarm.count > 1 ? ` +${alarm.count - 1}` : ''}
      </span>
    </span>
  );
}

export interface SchedulePageRowProps {
  life: HaloLifePayload | null;
  /** A failed read is NOT "nothing due". The page says what failed and offers Retry. */
  error: string | null;
  rowHeight: number;
  now: number;
  onRetry: () => void;
  onOpenSchedule: () => void;
  /** Add a RELATIVE alarm (mode='relative', lead_min) and refresh. */
  onAddAlarm: (deadlineId: string, leadMin: number) => Promise<{ ok: boolean; error?: string }>;
  onDeleteAlarm: (reminderId: string) => Promise<{ ok: boolean; error?: string }>;
  /** The deadline the stopwatch is currently bound to, and the ms since that binding began. */
  trackingId: string | null;
  trackedMs: number;
  onToggleTrack: (deadline: HaloLifeDeadline) => void;
}

const PRESETS = [
  { id: '1h', label: '1 hour', leadMin: 60 },
  { id: '1d', label: '1 day', leadMin: 1440 },
  { id: '0', label: 'On time', leadMin: 0 },
] as const;

export const SchedulePageRow = memo(function SchedulePageRow({
  life,
  error,
  rowHeight,
  now,
  onRetry,
  onOpenSchedule,
  onAddAlarm,
  onDeleteAlarm,
  trackingId,
  trackedMs,
  onToggleTrack,
}: SchedulePageRowProps) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = life ? sortDeadlines(life.deadlines) : [];
  const count = rows.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;
  const current = count ? rows[safeIndex] : null;

  /* Two rows visible: (rowHeight - 4) / 2. The 4 is the gap between rows. */
  const rowH = Math.max(16, Math.round((rowHeight - 4) / 2));

  /* The list can be replaced under us (a deadline is completed in the app). Clamp rather than
   * render an out-of-range row, which would blank the pinned left block. */
  useEffect(() => {
    if (index > 0 && index >= count) setIndex(Math.max(0, count - 1));
  }, [count, index]);

  /* Close the editor when the data under it changes identity — editing row 4 after row 4 was
   * deleted would otherwise write an alarm onto whatever slid into its place. */
  useEffect(() => {
    setEditing(false);
  }, [count]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2400);
    return () => window.clearTimeout(t);
  }, [note]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const next = Math.round(el.scrollTop / (rowH + 4));
    if (next !== index) setIndex(Math.max(0, Math.min(count - 1, next)));
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    const next = Math.max(0, Math.min(count - 1, safeIndex + dir));
    setIndex(next);
    listRef.current?.scrollTo({ top: next * (rowH + 4), behavior: 'smooth' });
  };

  const openEditor = () => {
    if (!current) return;
    setEditing(true);
  };

  const hasPreset = (leadMin: number): HaloLifeAlarm | null => {
    if (!current) return null;
    const alarms = current.alarms ?? [];
    return alarms.find((a) => a.mode === 'relative' && a.leadMin === leadMin && !a.fired) ?? null;
  };

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyKey(key);
    const res = await fn();
    setBusyKey(null);
    if (res.ok) {
      setNote('Alarm saved.');
      onRetry();
    } else {
      setNote(res.error || 'Alarm not saved. Retry.');
    }
  };

  const togglePreset = (leadMin: number) => {
    if (!current || busyKey) return;
    const existing = hasPreset(leadMin);
    if (existing?.id) {
      void run(`del:${existing.id}`, () => onDeleteAlarm(existing.id as string));
    } else {
      void run(`add:${leadMin}`, () => onAddAlarm(current.id, leadMin));
    }
  };

  /* ── ERROR ──────────────────────────────────────────────────────────────────────────────
   * Not "nothing due". Says what failed and offers the one action that can help. */
  if (error) {
    return (
      <div className="halo-sched" style={{ height: rowHeight, width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 'var(--halo-t-value, 13px)', color: 'var(--halo-text)', minWidth: 0 }}>
          Schedule could not load. Retry.
        </span>
        <span style={{ flex: 1 }} />
        <IconBtn label="Retry loading the schedule" onClick={onRetry}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
      </div>
    );
  }

  /* ── LOADING ───────────────────────────────────────────────────────────────────────────
   * Skeleton bars, no shimmer, and never a zero. */
  if (!life) {
    return (
      <div
        className="halo-sched"
        aria-busy="true"
        style={{ height: rowHeight, width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--halo-gap-loose, 12px)' }}
      >
        <div style={{ flex: '0 0 clamp(100px, 22%, 150px)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={EYEBROW}>Next</span>
          <span style={{ width: 90, height: 12, borderRadius: 4, background: 'var(--halo-tab)' }} />
        </div>
        <span aria-hidden="true" style={{ width: 1, height: rowHeight - 8, background: 'var(--halo-border)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ width: '70%', height: 12, borderRadius: 4, background: 'var(--halo-tab)' }} />
          <span style={{ width: '55%', height: 12, borderRadius: 4, background: 'var(--halo-tab)' }} />
        </div>
      </div>
    );
  }

  const schedule = life.schedule;
  const scheduleIsNow = !!schedule?.isNow;
  const scheduleOffset = schedule ? dayOffset(schedule.startsAtMs, life.now) : 99;
  const leftMinutes = schedule ? Math.max(0, Math.round((schedule.endsAtMs - now) / 60_000)) : 0;

  /* ── ALARM EDITOR — the SAME row, swapped content, so the height never changes (§4.6). */
  if (editing && current) {
    return (
      <div
        className="halo-sched"
        role="group"
        aria-label={`Alarm for ${current.title || 'deadline'}`}
        style={{ height: rowHeight, width: '100%', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
      >
        <div style={{ flex: '0 0 clamp(120px, 28%, 170px)', minWidth: 0 }}>
          {/* An error is a SENTENCE, not a label: it wraps inside the block instead of running
              under the chips, and the full text is on the title attribute as a fallback. */}
          <span
            title={note ?? undefined}
            style={{
              ...EYEBROW,
              display: 'block',
              textTransform: note ? 'none' : 'uppercase',
              letterSpacing: note ? 0 : '0.08em',
              whiteSpace: 'normal',
              color: note ? 'var(--halo-muted)' : 'var(--halo-dim)',
              maxHeight: 30,
              overflow: 'hidden',
            }}
          >
            {note ?? 'Alarm'}
          </span>
          <span
            className="truncate"
            title={current.title}
            style={{ display: 'block', fontSize: 'var(--halo-t-value, 13px)', color: 'var(--halo-text)', fontWeight: 500 }}
          >
            {current.title || 'Untitled'}
          </span>
        </div>
        <div
          role="group"
          aria-label="Alarm times"
          style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end', minWidth: 0, overflowX: 'auto' }}
        >
          {PRESETS.map((p) => {
            const on = !!hasPreset(p.leadMin);
            return (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={busyKey === `add:${p.leadMin}` || busyKey === `del:${hasPreset(p.leadMin)?.id ?? ''}`}
                onClick={() => togglePreset(p.leadMin)}
                style={{
                  ...QUICK,
                  background: on ? 'var(--halo-tab)' : 'transparent',
                  fontWeight: on ? 500 : 400,
                  boxShadow: on ? '0 0 0 2px var(--halo-accent)' : 'none',
                  borderColor: on ? 'transparent' : 'var(--halo-border)',
                }}
              >
                {on && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                {p.label}
              </button>
            );
          })}
          <button type="button" onClick={onOpenSchedule} style={QUICK}>
            Custom
          </button>
        </div>
        <IconBtn label="Close alarm editor" onClick={() => setEditing(false)}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
      </div>
    );
  }

  /* ── EMPTY — both tables answered and both said none (§5). */
  if (!schedule && count === 0) {
    return (
      <div className="halo-sched" style={{ height: rowHeight, width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 'var(--halo-t-value, 13px)', color: 'var(--halo-muted)' }}>
          No open deadlines. Add one in Schedule.
        </span>
        <span style={{ flex: 1 }} />
        <IconBtn label="Open Schedule" onClick={onOpenSchedule}>
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </IconBtn>
      </div>
    );
  }

  return (
    <div
      className="halo-sched"
      style={{ height: rowHeight, width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {/* ── LEFT: the nearest class block, PINNED. It never scrolls with the deadlines. */}
      {schedule && (
        <>
          <div
            className="halo-sched-class"
            data-halo-life-row="class"
            style={{
              flex: '0 0 clamp(100px, 22%, 150px)',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span style={EYEBROW}>
              {scheduleIsNow ? 'Now' : 'Next'}
              {(scheduleIsNow || scheduleOffset <= 1) && (
                <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
                  {scheduleIsNow ? `${leftMinutes}m left` : formatIn(schedule.startsAtMs - now)}
                </span>
              )}
            </span>
            <span
              className="truncate"
              title={schedule.title}
              style={{ fontSize: 'var(--halo-t-value, 13px)', fontWeight: 500, color: 'var(--halo-text)' }}
            >
              {schedule.title || 'Untitled'}
            </span>
            <span
              className="truncate"
              title={schedule.location ?? undefined}
              style={{ fontFamily: MONO, fontSize: 'var(--halo-t-label, 11px)', color: 'var(--halo-dim)' }}
            >
              {scheduleIsNow
                ? `until ${hhmm(schedule.endTime)}`
                : `${formatBlockWhen(schedule, now)}${count > 2 ? ` · ${safeIndex + 1}/${count}` : ''}`}
            </span>
          </div>
          <span
            aria-hidden="true"
            style={{ width: 1, height: rowHeight - 8, background: 'var(--halo-border)', flexShrink: 0 }}
          />
        </>
      )}

      {/* ── CENTRE: every open deadline, two rows visible, scroll-snap inside itself. */}
      <div
        ref={listRef}
        data-halo-life-list="true"
        role="listbox"
        aria-label="Open deadlines"
        tabIndex={0}
        aria-activedescendant={current ? `halo-dl-${current.id}` : undefined}
        onWheel={(e) => e.stopPropagation()}
        onScroll={onScroll}
        onKeyDown={onListKey}
        style={{
          containerType: 'inline-size',
          height: rowHeight,
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          scrollbarWidth: 'none',
          position: 'relative',
        }}
      >
        {count === 0 && schedule && (
          <span style={{ ...LABEL, height: rowHeight, display: 'flex', alignItems: 'center' }}>
            No open deadlines.
          </span>
        )}
        {rows.map((d, i) => {
          const alarm = pickAlarm(d, now);
          const isCurrent = i === safeIndex;
          return (
            <div
              key={d.id || d.title}
              id={`halo-dl-${d.id}`}
              role="option"
              aria-selected={isCurrent}
              data-halo-life-row="deadline"
              title={`${d.title || 'Untitled'} — ${formatDeadlineDue(d.deltaMs)}`}
              style={{
                height: rowH,
                flex: 'none',
                scrollSnapAlign: 'start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 8px',
                borderRadius: 8,
                minWidth: 0,
                fontSize: 'var(--halo-t-value, 13px)',
                background: isCurrent ? 'var(--halo-tab)' : 'transparent',
                transition: 'background 150ms var(--halo-ease)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: d.isOverdue ? 'var(--halo-signal)' : 'var(--halo-dim)',
                }}
              />
              <span className="truncate" style={{ flex: 1, minWidth: 0, color: 'var(--halo-text)' }}>
                {d.title || 'Untitled'}
              </span>
              {trackingId === d.id ? (
                <span
                  data-halo-track-chip="true"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, color: 'var(--halo-accent)' }}
                >
                  <Timer size={11} strokeWidth={2} aria-hidden="true" />
                  <span style={{ fontFamily: MONO, fontSize: 'var(--halo-t-label, 11px)' }}>
                    {formatElapsed(trackedMs)}
                  </span>
                </span>
              ) : (
                <AlarmChip alarm={alarm} />
              )}
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 'var(--halo-t-label, 11px)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  color: d.isOverdue ? 'var(--halo-signal)' : 'var(--halo-dim)',
                }}
              >
                {formatDeadlineDue(d.deltaMs)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── RIGHT: the two buttons that act on the current row. 44px, not 22. */}
      {current && (
        <>
          <IconBtn label={`Set alarm for ${current.title || 'deadline'}`} onClick={openEditor}>
            <Bell size={16} strokeWidth={2} aria-hidden="true" />
          </IconBtn>
          <IconBtn
            label={`Track time on ${current.title || 'deadline'}`}
            pressed={trackingId === current.id}
            onClick={() => onToggleTrack(current)}
          >
            <Timer size={16} strokeWidth={2} aria-hidden="true" />
          </IconBtn>
        </>
      )}
    </div>
  );
});
