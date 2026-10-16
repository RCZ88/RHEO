/**
 * Reminder ticker — actually FIRES the reminder rows the schema already had.
 *
 * THE BUG THIS FIXES
 *
 * `deadline_reminders` (id, deadline_id, mode, lead_min, remind_at, fired) and
 * `reminders.reminder_lead_min` were both created in `main.ts`'s migration
 * block, with indexes specifically for the pending lookup
 * (`idx_deadline_reminders_pending ON (fired, remind_at)`). Nothing in the
 * codebase ever read them. A grep for those identifiers across `src/main.ts`
 * returned only the CREATE / CREATE INDEX / ALTER / PRAGMA lines. So a user
 * could set a reminder on a deadline and it would be stored perfectly and
 * never fire — which is exactly the "reminders don't work" report.
 *
 * WHY A MAIN-PROCESS INTERVAL
 *
 * The obvious place to put this is a renderer `useEffect`. That would be wrong:
 * `App.tsx` renders `<Routes key={location.pathname}>`, so navigating away
 * unmounts every page-level effect and its interval dies with it. A reminder
 * set for 09:00 would stop firing the moment the user opened the terminal.
 * This lives beside `checkDeadlinesAndNotify`, which has the same requirement
 * and the same 5-minute cadence.
 *
 * NOTHING HERE IS AUTOMATIC. A row only exists if the user created a reminder,
 * and it only fires once `fired` flips to 1. This module never invents a
 * reminder — it only delivers the ones that were asked for.
 */

const REMINDER_POLL_MS = 60_000

/** ISO-ish local timestamp matching SQLite's `datetime('now')` shape. */
function sqliteLocalNow(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Fire due deadline reminders.
 *
 * `remind_at` is already an absolute timestamp computed when the row was
 * created, so firing is a single indexed comparison — no lead-time arithmetic
 * here. `mode` is recorded for the UI's benefit but is not needed to decide
 * whether a row is due.
 */
export function fireDueDeadlineReminders(db: any): number {
  const now = sqliteLocalNow()
  let rows: any[] = []
  try {
    rows = db.prepare(`
      SELECT r.id, r.remind_at, r.lead_min, d.title, d.course, d.due_date
      FROM deadline_reminders r
      JOIN deadlines d ON d.id = r.deadline_id
      WHERE r.fired = 0
        AND r.remind_at IS NOT NULL
        AND r.remind_at <= ?
      ORDER BY r.remind_at ASC
      LIMIT 20
    `).all(now) as any[]
  } catch (e: any) {
    console.warn('[Reminders] query failed:', e?.message)
    return 0
  }

  if (rows.length === 0) return 0

  const { enqueueNotification } = require('./notifications')
  let fired = 0
  for (const row of rows) {
    try {
      // Lead time is surfaced in the body so "1 day before" reads differently
      // from "10 minutes before" — otherwise several reminders for the same
      // deadline are indistinguishable in the inbox.
      const lead = row.lead_min > 0 ? describeLead(row.lead_min) : 'now'
      enqueueNotification(db, {
        id: `dl-rem-${row.id}`,
        kind: 'reminder',
        title: row.title || 'Deadline reminder',
        body: `${lead} · ${row.course ? row.course + ' · ' : ''}${row.due_date || ''}`.trim(),
        tier: row.lead_min <= 60 ? 'warn' : 'info',
        data: { deadlineId: row.deadline_id, reminderId: row.id, leadMin: row.lead_min },
      })
      db.prepare('UPDATE deadline_reminders SET fired = 1 WHERE id = ?').run(row.id)
      fired++
    } catch (e: any) {
      // A single bad row must not stop the others, and must not leave the row
      // marked fired — the next tick will retry it.
      console.warn('[Reminders] failed to fire row', row.id, e?.message)
    }
  }
  return fired
}

/**
 * Fire due standalone reminders (`reminders` table).
 *
 * A reminder fires when its due moment is within `reminder_lead_min` of now.
 * That is computed here rather than stored, because `reminders` predates the
 * deadline_reminders table and has no `remind_at` column to compare against.
 */
export function fireDueReminders(db: any): number {
  let rows: any[] = []
  try {
    rows = db.prepare(`
      SELECT id, text, due_date, due_time, reminder_lead_min, location
      FROM reminders
      WHERE done = 0
        AND due_date IS NOT NULL
        AND due_time IS NOT NULL
        AND reminder_lead_min > 0
      ORDER BY due_date ASC, due_time ASC
      LIMIT 50
    `).all() as any[]
  } catch (e: any) {
    console.warn('[Reminders] standalone query failed:', e?.message)
    return 0
  }

  if (rows.length === 0) return 0

  const { enqueueNotification } = require('./notifications')
  const now = new Date()
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  let fired = 0

  for (const row of rows) {
    try {
      const [h, m] = String(row.due_time).split(':').map(Number)
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue
      const dueMinute = h * 60 + m
      const dueToday = row.due_date === todayLocal(now)
      if (!dueToday) continue

      // Fire when we are inside the lead window but not before it opens.
      const lead = Number(row.reminder_lead_min) || 0
      if (nowMinute < dueMinute - lead) continue
      // Already past the due time by more than the lead window — that is the
      // deadline ticker/checkDeadlines' job, not ours. Skip to avoid a
      // duplicate notification for the same reminder.
      if (nowMinute > dueMinute) continue

      enqueueNotification(db, {
        id: `rem-${row.id}-${row.due_date}`,
        kind: 'reminder',
        title: row.text || 'Reminder',
        body: `${describeLead(lead)} · ${row.due_time}${row.location ? ' · ' + row.location : ''}`,
        tier: 'info',
        data: { reminderId: row.id, dueDate: row.due_date },
      })
      fired++
    } catch (e: any) {
      console.warn('[Reminders] failed to fire standalone row', row.id, e?.message)
    }
  }
  return fired
}

function todayLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "1 day before" / "3 hours before" / "10 minutes before". */
function describeLead(minutes: number): string {
  if (minutes <= 0) return 'Due now'
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`
  return `${minutes} min before`
}

/** Start the ticker. Safe to call once at app-ready. */
export function startReminderTicker(getDb: () => any): void {
  const tick = () => {
    const db = getDb()
    if (!db) return
    try {
      const a = fireDueDeadlineReminders(db)
      const b = fireDueReminders(db)
      if (a + b > 0) console.log(`[Reminders] fired ${a + b}`)
    } catch (e: any) {
      console.error('[Reminders] tick error:', e)
    }
  }
  // One immediate pass catches anything that came due while the app was closed,
  // then every minute. 60s rather than 5min because a reminder with a 10-minute
  // lead is user-visible and 5-minute polling makes it feel broken.
  setTimeout(tick, 5000)
  setInterval(tick, REMINDER_POLL_MS)
}