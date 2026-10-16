/**
 * Deadline reminders — the distinction that was missing.
 *
 * A deadline has TWO different moments and conflating them is why the feature
 * never worked:
 *
 *   due  = when the thing HAPPENS. Required. Owned by the deadline.
 *   reminder = when you want to be TOLD about it. Optional, and it has two
 *              genuinely different shapes.
 *
 * MODE 'relative' — "1 day before", "2 hours before". Stored as a LEAD TIME
 *   (minutes before `due`), never as a timestamp. This is the important part:
 *   if you move the deadline, a relative reminder MOVES WITH IT and the lead is
 *   still true. Baking it into a timestamp means rescheduling silently lies —
 *   you asked to be told a day before, and it tells you a day before the OLD
 *   date, which is no longer a day before anything.
 *
 * MODE 'absolute' — "on the 3rd at 14:00". Stored as a real instant. Clamped to
 *   [now, due] because a reminder after the thing happens is not a reminder,
 *   and one before "now" fires the instant it is saved and is noise.
 *
 * Multiple reminders per deadline are the norm, not a special case: "tell me a
 * week out AND the morning of" is the actual shape of the request, and the old
 * single `remind_at` column could only ever hold one.
 */

/** Minutes of lead, in the order a person would scan the list. */
export const LEAD_PRESETS: { min: number; label: string; short: string }[] = [
  { min: 0, label: 'At the deadline', short: 'At due' },
  { min: 30, label: '30 minutes before', short: '30m before' },
  { min: 60, label: '1 hour before', short: '1h before' },
  { min: 180, label: '3 hours before', short: '3h before' },
  { min: 360, label: '6 hours before', short: '6h before' },
  { min: 720, label: '12 hours before', short: '12h before' },
  { min: 1440, label: '1 day before', short: '1d before' },
  { min: 2880, label: '2 days before', short: '2d before' },
  { min: 4320, label: '3 days before', short: '3d before' },
  { min: 10080, label: '1 week before', short: '1w before' },
];

export type ReminderMode = 'relative' | 'absolute';

export interface DeadlineReminder {
  id: string;
  deadline_id: string;
  /** 'relative' = lead time before due; 'absolute' = a fixed instant. */
  mode: ReminderMode;
  /** Minutes before `due`. ONLY meaningful when mode === 'relative'. */
  lead_min: number;
  /** ISO instant. ONLY meaningful when mode === 'absolute'. */
  remind_at: string | null;
  /** Set once the notification has fired, so it never fires twice. */
  fired: number;
  created_at: string;
}

/** Anything that can stand in for a deadline while this logic runs. */
export interface DeadlineLike {
  id?: string;
  due_date: string;
  due_time?: string | null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * The deadline's own moment. `due_date` may be a bare 'YYYY-MM-DD' or a full
 * ISO stamp, and `due_time` may carry the clock time separately. Built in LOCAL
 * time deliberately: a deadline at 09:00 means 09:00 where the user is, and
 * parsing 'YYYY-MM-DD' as UTC puts it a day off for anyone east of Greenwich.
 */
export function deadlineInstant(d: DeadlineLike): Date | null {
  const raw = String(d.due_date ?? '').trim();
  if (!raw) return null;

  const ymd = raw.slice(0, 10);
  // Test the ORIGINAL string, not the slice: slicing a full ISO stamp leaves a
  // bare YYYY-MM-DD, which always matches — so the branch below ran the
  // date-only path and an explicit 18:30 deadline silently became 09:00.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const hm = dateOnly
    ? (d.due_time && /^([01]?\d|2[0-3]):[0-5]\d$/.test(d.due_time.trim())
        ? d.due_time.trim()
        : '09:00')
    : raw.slice(11, 16);

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const parts = hm.split(':').map(n => parseInt(n, 10));
  const out = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    Number.isFinite(parts[0]) ? parts[0] : 9,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    0,
    0,
  );
  return Number.isNaN(out.getTime()) ? null : out;
}

/** When a reminder should actually fire. Relative leads resolve against `due`. */
export function fireTimeFor(r: Pick<DeadlineReminder, 'mode' | 'lead_min' | 'remind_at'>, d: DeadlineLike): Date | null {
  if (r.mode === 'absolute') {
    if (!r.remind_at) return null;
    const t = new Date(r.remind_at);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const due = deadlineInstant(d);
  if (!due) return null;
  const lead = Number.isFinite(r.lead_min) ? Math.max(0, Math.trunc(r.lead_min)) : 0;
  return new Date(due.getTime() - lead * MIN);
}

/** "1d before" — the lead as a person would say it, not `1440`. */
export function describeLead(leadMin: number): string {
  const min = Math.max(0, Math.trunc(Number(leadMin) || 0));
  if (min === 0) return 'At the deadline';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} before`;
  if (min % (7 * 24 * 60) === 0) {
    const w = min / (7 * 24 * 60);
    return `${w} week${w === 1 ? '' : 's'} before`;
  }
  if (min % (24 * 60) === 0) {
    const d = min / (24 * 60);
    return `${d} day${d === 1 ? '' : 's'} before`;
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return `${h} hour${h === 1 ? '' : 's'} before`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m before`;
}

/** When this reminder will actually go off, in words — or null if it can't. */
export function describeWhen(r: DeadlineReminder, d: DeadlineLike, now: Date = new Date()): string | null {
  const fire = fireTimeFor(r, d);
  if (!fire) return null;
  if (r.mode === 'relative') {
    const lead = describeLead(r.lead_min);
    return lead === 'At the deadline' ? lead : `${lead} (${formatStamp(fire)})`;
  }
  const diff = fire.getTime() - now.getTime();
  if (diff < 0) return 'already passed';
  if (diff < HOUR) return `in ${Math.max(1, Math.round(diff / MIN))} min`;
  if (diff < DAY) return `in ${Math.round(diff / HOUR)} h`;
  return `in ${Math.round(diff / DAY)} d`;
}

function formatStamp(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return t;
  const tmrw = new Date(now.getTime() + DAY);
  if (d.toDateString() === tmrw.toDateString()) return `tomorrow ${t}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${t}`;
}

/**
 * Normalise a new/edit reminder before it is saved.
 *
 * Returns the cleaned field set, or an error string. The clamp is the
 * load-bearing part: it is what stops "remind me at a time that has passed"
 * and "remind me after the deadline" from being storable.
 */
export function normalizeReminder(
  input: { mode?: string; lead_min?: number; remind_at?: string | null },
  d: DeadlineLike,
  now: Date = new Date(),
): { ok: true; value: { mode: ReminderMode; lead_min: number; remind_at: string | null } } | { ok: false; error: string } {
  const due = deadlineInstant(d);
  if (!due) return { ok: false, error: 'This deadline has no valid date, so it cannot have a reminder.' };

  const mode: ReminderMode = input.mode === 'absolute' ? 'absolute' : 'relative';

  if (mode === 'relative') {
    const lead = Math.max(0, Math.trunc(Number(input.lead_min) || 0));
    const fire = new Date(due.getTime() - lead * MIN);
    if (fire.getTime() <= now.getTime()) {
      return {
        ok: false,
        error:
          lead === 0
            ? `That deadline has already passed, so "at the deadline" is in the past.`
            : `${describeLead(lead)} has already passed — that is ${formatStamp(fire)}.`,
      };
    }
    return { ok: true, value: { mode, lead_min: lead, remind_at: null } };
  }

  if (!input.remind_at) return { ok: false, error: 'Pick the date and time you want to be reminded.' };
  const fire = new Date(input.remind_at);
  if (Number.isNaN(fire.getTime())) return { ok: false, error: 'That reminder time could not be read.' };
  if (fire.getTime() <= now.getTime()) return { ok: false, error: 'That reminder time has already passed.' };
  if (fire.getTime() > due.getTime()) {
    return { ok: false, error: `A reminder cannot be after the deadline itself (${formatStamp(due)}).` };
  }
  return { ok: true, value: { mode, lead_min: 0, remind_at: fire.toISOString() } };
}

/**
 * Sort reminders by when they will fire, soonest first, and drop the ones that
 * can no longer fire (a deadline moved back under them, or they were absolute
 * and have gone by). Sorting by LEAD instead of by instant would put "1 week
 * before" last, which is the wrong order to read a list in.
 */
export function liveReminders(
  reminders: DeadlineReminder[],
  d: DeadlineLike,
  now: Date = new Date(),
): { live: DeadlineReminder[]; expired: DeadlineReminder[] } {
  const live: DeadlineReminder[] = [];
  const expired: DeadlineReminder[] = [];
  for (const r of reminders) {
    if (!r) continue;                       // a null row is skipped, not a crash
    const fire = fireTimeFor(r, d);
    if (!fire || fire.getTime() <= now.getTime() || r.fired) expired.push(r);
    else live.push(r);
  }
  live.sort((a, b) => (fireTimeFor(a, d)!.getTime() - fireTimeFor(b, d)!.getTime()));
  return { live, expired };
}

/** A stable id for a new reminder. */
export function newReminderId(deadlineId: string, now: Date = new Date()): string {
  return `drem_${deadlineId}_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}