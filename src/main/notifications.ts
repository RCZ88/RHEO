/**
 * NotificationCenter — unified notification service for RHEO.
 *
 * Single source of truth for all user-facing notifications:
 *  - Deadline reminders (replaces the old checkDeadlines)
 *  - Human-centric triggers: app-switch pause hint, focus session done, long-gap summary
 *  - Automation/engine notifications routed through the same pipe
 *  - Persistent SQLite inbox so notifications survive app restart
 *  - IPC bridge so the renderer can render an inbox + toasts
 *
 * Architecture:
 *  - main process owns the SQLite `notifications` table + notification logic
 *  - main process emits `notification:new` / `notification:updated` / `notification:removed`
 *    IPC events; renderer listens and renders toasts + bell-badge count
 *  - renderer can dismiss / mark-read via IPC; state lives in main, not renderer
 */

import { Notification, powerMonitor } from 'electron'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { execSync, spawnSync } from 'child_process'

// ---------------------------------------------------------------------------
// Platform detection for notification strategy
// ---------------------------------------------------------------------------

/** True when the current platform has a working Electron Notification backend. */
function canUseElectronNotification(): boolean {
  // Windows and macOS: native notification center, always works.
  if (process.platform === 'win32' || process.platform === 'darwin') return true
  // Linux: Electron uses libnotify/DBus — needs a running daemon (dunst, mako,
  // notify-osd, …). Probe once at init time.
  if (process.platform === 'linux') return _linuxHasDbusNotifier()
  return false
}

let _linuxProbeCache: boolean | null = null
function _linuxHasDbusNotifier(): boolean {
  if (_linuxProbeCache != null) return _linuxProbeCache
  try {
    execSync(
      'dbus-send --session --print-reply --dest=org.freedesktop.Notifications ' +
      '/org/freedesktop/Notifications org.freedesktop.Notifications.GetCapabilities ' +
      '2>/dev/null',
      { timeout: 2000, stdio: 'ignore' },
    )
    _linuxProbeCache = true
  } catch {
    _linuxProbeCache = false
  }
  return _linuxProbeCache
}

/** Escape a string for safe use in a shell double-quoted argument. */
function shellEscape(s: string): string {
  return s.replace(/["\\$`!|]/g, '\\$&')
}

/** Resolve a notification icon that exists on disk for the current platform. */
function resolveNotifIcon(): string {
  const userData = electronApp.getPath('userData')
  // Prefer PNG on all platforms (Windows Notification Center also accepts PNG).
  const png = path.join(userData, '..', '..', 'RHEO_AppIcon.png')
  if (fs.existsSync(png)) return png
  const ico = path.join(userData, '..', '..', 'RHEO_AppIcon.ico')
  if (fs.existsSync(ico)) return ico
  return ''
}

// ---------------------------------------------------------------------------
// Fallback: CLI notify-send (Linux only, when no DBus daemon is present)
// ---------------------------------------------------------------------------

function sendNotifySend(title: string, body: string, icon: string): void {
  if (process.platform !== 'linux') return
  try {
    const iconArg = icon ? `-i "${shellEscape(icon)}"` : ''
    execSync(
      `notify-send -a "RHEO" ${iconArg} "${shellEscape(title)}" "${shellEscape(body)}"`,
      { timeout: 5000, stdio: 'ignore' },
    )
  } catch (e: any) {
    console.warn('[Notifications] notify-send failed:', e.message)
  }
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------
//
// WHY SOUND LIVES HERE AND NOT IN THE RENDERER
//
// `src/services/NotificationService.ts` plays beeps with a Web Audio
// `OscillatorNode` in the page. That only makes noise while the renderer is
// alive AND the window is focused enough for the AudioContext to be running.
// A timer firing at 3am, or a reminder arriving while the user is in the
// terminal, produced silence. The MAIN process has no such dependency — it
// outlives every route, every `<Routes key={location.pathname}>` remount, and
// any hidden window. So every sound now goes through `playNotificationSound`.
//
// Linux has no `Notification.sound`; the freedesktop spec puts audio in the
// `sound-name` hint and even that is optional. The portable path is to play a
// system sound file ourselves, which is what the player list below does.

let _soundMuted: boolean | null = null

/** True when the user has muted notification sound (app_settings key). */
export function isSoundMuted(db?: Db): boolean {
  if (db) {
    try {
      const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'notification_sound'`).get() as any
      if (row?.value != null) return row.value === 'off'
    } catch { /* table may not exist yet — fall through to the cached value */ }
  }
  return _soundMuted === true
}

/** Persist the mute preference. Safe to call before the DB is ready (no-op). */
export function setSoundMuted(db: Db | undefined, muted: boolean): void {
  _soundMuted = muted
  if (!db) return
  try {
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES ('notification_sound', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(muted ? 'off' : 'on')
  } catch { /* no DB yet — the in-memory cache still applies this session */ }
}

/** Seed the cached mute flag from the DB once at startup. */
export function loadSoundPreference(db: Db): void {
  try {
    const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'notification_sound'`).get() as any
    _soundMuted = row?.value === 'off'
  } catch {
    _soundMuted = false
  }
}

/** Per-tier sound file. `error`/`warn` get the attention-grabbing alert tone. */
const SOUND_FILE: Record<string, string[]> = {
  error: ['/usr/share/sounds/freedesktop/stereo/dialog-error.oga', '/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga'],
  warn: ['/usr/share/sounds/freedesktop/stereo/dialog-warning.oga', '/usr/share/sounds/freedesktop/stereo/message.oga'],
  success: ['/usr/share/sounds/freedesktop/studio/bell.oga', '/usr/share/sounds/freedesktop/stereo/complete.oga'],
  info: ['/usr/share/sounds/freedesktop/stereo/message.oga', '/usr/share/sounds/freedesktop/stereo/bell.oga'],
}

/**
 * Play a short system sound for a notification tier.
 *
 * Deliberately `spawnSync`-free and failure-silent: a missing sound file or a
 * missing player must NEVER throw into the notification path, because that
 * path also writes the inbox row. Sound is best-effort; the notification is not.
 */
export function playNotificationSound(tier: string = 'info'): void {
  try {
    if (isSoundMuted()) return

    if (process.platform === 'win32' || process.platform === 'darwin') {
      // Electron's shell has no portable "play a sound file" call. On these
      // platforms the OS notification carries its own sound, so this is a no-op
      // by design rather than a silent failure.
      return
    }

    if (process.platform !== 'linux') return

    const candidates = SOUND_FILE[tier] ?? SOUND_FILE.info
    const file = candidates.find((p) => fs.existsSync(p))
    if (!file) {
      console.warn(`[Notifications] no sound file found for tier "${tier}" (looked in ${candidates.join(', ')})`)
      return
    }

    // `paplay` ships with PulseAudio, `canberra-gtk-play` with GTK. Try each
    // player with each file; the first success wins and the rest are skipped.
    const players = ['paplay', 'canberra-gtk-play', 'aplay -q']
    for (const player of players) {
      const [bin, ...prefix] = player.split(' ')
      const res = spawnSync(bin, [...prefix, file], { stdio: 'ignore', timeout: 3000 })
      if (!res.error && res.status === 0) return
    }
    console.warn('[Notifications] no audio player available (paplay / canberra-gtk-play / aply)')
  } catch (e: any) {
    console.warn('[Notifications] sound failed:', e?.message)
  }
}

// ---------------------------------------------------------------------------
// IPC event emitter — renderer listens for live toasts + bell-badge refresh
// ---------------------------------------------------------------------------

function emitNotifNew(n: { id: string; kind: string; title: string; body: string; tier: string; data: string }) {
  try {
    const win = electronApp.windows?.[0] ?? null
    if (win && !win.isDestroyed()) {
      win.webContents.send('notification:new', n)
    }
  } catch { /* window may not exist yet */ }
}

// ---------------------------------------------------------------------------
// Diaspora: we receive `db` from main.ts (can be null during early init).
// ---------------------------------------------------------------------------

type Db = any // better-sqlite3 handle, or null

interface NotifRow {
  id: string
  kind: string
  title: string
  body: string
  tier: 'info' | 'warn' | 'success' | 'error'
  read: number // 0/1
  dismissed: number // 0/1
  data: string // JSON — kind-specific payload
  created_at: number
}

// ---------------------------------------------------------------------------
// Table + helpers
// ---------------------------------------------------------------------------

const NOTIF_TIER_LABELS: Record<string, string> = {
  info: 'Info',
  warn: 'Reminder',
  success: 'Done',
  error: 'Alert',
}

export function ensureNotificationTable(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL DEFAULT 'generic',
      title       TEXT NOT NULL,
      body        TEXT NOT NULL DEFAULT '',
      tier        TEXT NOT NULL DEFAULT 'info' CHECK(tier IN ('info','warn','success','error')),
      read        INTEGER NOT NULL DEFAULT 0,
      dismissed   INTEGER NOT NULL DEFAULT 0,
      data        TEXT NOT NULL DEFAULT '{}',
      created_at  INTEGER NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notif_dismissed ON notifications(dismissed)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notif_created   ON notifications(created_at)`)
}

/** Insert or ignore (idempotent). Returns the row id. */
export function enqueueNotification(db: Db, n: {
  id: string
  kind: string
  title: string
  body: string
  tier: 'info' | 'warn' | 'success' | 'error'
  data?: Record<string, any>
}): string {
  const createdAt = Date.now()
  db.prepare(`
    INSERT OR IGNORE INTO notifications (id, kind, title, body, tier, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(n.id, n.kind, n.title, n.body, n.tier, JSON.stringify(n.data ?? {}), createdAt)

  // Fire OS notification + emit IPC event for live renderer updates.
  try {
    const icon = resolveNotifIcon()
    const muted = isSoundMuted(db)

    if (canUseElectronNotification()) {
      // Windows / macOS, or Linux with a working DBus notification daemon.
      new Notification({
        title: n.title,
        body: n.body,
        icon,
        // Electron honours `sound` on Windows/macOS only; on Linux the daemon
        // may ignore it entirely. `playNotificationSound` below is the reliable
        // path, so the flag is suppressed there rather than double-playing.
        // Electron's `NotificationConstructorOptions.sound` is typed `string`,
        // not boolean, so this is the sound NAME rather than a flag. An empty
        // string means silent. On Linux the flag is forced empty because the
        // daemon ignores it and `playNotificationSound` handles audio instead.
        sound: (muted || process.platform === 'linux')
          ? ''
          : (n.tier === 'error' || n.tier === 'warn' ? 'Notification' : 'Default'),
      }).show()
    } else if (process.platform === 'linux') {
      // No DBus notification daemon — fall back to notify-send CLI.
      sendNotifySend(n.title, n.body, icon)
    }

    // One sound for every tier, every platform, regardless of which OS-notify
    // path above ran. Runs in the main process so it is audible with the
    // window unfocused or a route remount mid-reminder.
    if (!muted) playNotificationSound(n.tier)
    // else: unsupported platform — inbox row is still the source of truth.

    // Notify renderer for live toasts + bell-badge refresh.
    emitNotifNew({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      tier: n.tier,
      data: JSON.stringify(n.data ?? {}),
    })
  } catch (err: any) {
    console.warn('[Notifications] OS notification failed:', err?.message || err)
  }

  return n.id
}

/** List non-dismissed, newest first. */
export function listNotifications(db: Db, limit = 50): NotifRow[] {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE dismissed = 0
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as NotifRow[]
}

/** Count unread (for bell-badge). */
export function unreadCount(db: Db): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE dismissed = 0 AND read = 0`).get() as any
  return row ? row.c : 0
}

/** Mark read. */
export function markRead(db: Db, id: string) {
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(id)
}

/** Dismiss (soft-delete). */
export function dismissNotification(db: Db, id: string) {
  db.prepare(`DELETE FROM notifications WHERE id = ?`).run(id)
}

// ===========================================================================
// Human-centric trigger helpers
// ===========================================================================

/** Called when the user switches away from a tracked app to a "pause" app
 *  (or to an empty foreground). Shows a gentle nudge if we've been tracking
 *  a productive session for > 5 min and the user hasn't seen a hint recently. */
export function maybeAppSwitchHint(
  db: Db,
  prevApp: string | null,
  prevCategory: string,
  trackedSeconds: number,
  lastHintAtPath: string,
): void {
  // Only nudge for productive apps, and only if we tracked > 5 min
  if (!prevApp || trackedSeconds < 300) return
  if (prevCategory !== 'productive' && prevCategory !== 'neutral') return

  const lastHint = Number(fs.readFileSync(lastHintAtPath, 'utf-8').trim()) || 0
  if (Date.now() - lastHint < 4 * 60 * 60 * 1000) return // cooldown 4 h

  const id = `hint-${Date.now()}`
  enqueueNotification(db, {
    id,
    kind: 'app-switch-hint',
    title: 'Session active',
    body: `You were in ${prevApp} for ${Math.round(trackedSeconds / 60)} min. Come back anytime — we saved your progress.`,
    tier: 'info',
    data: { prevApp, trackedSeconds },
  })
  fs.writeFileSync(lastHintAtPath, String(Date.now()))
}

/** Called when a deep-focus session completes. */
export function focusSessionDone(db: Db, goalLabel: string, durationSec: number): void {
  const id = `focus-done-${Date.now()}`
  enqueueNotification(db, {
    id,
    kind: 'focus-done',
    title: 'Focus session complete',
    body: `"${goalLabel}" — ${Math.round(durationSec / 60)} min focused. Great work.`,
    tier: 'success',
    data: { goalLabel, durationSec },
  })
}

/** Called when the system resumes from sleep and we detect a long gap
 *  (> 2 h) since the user was last active. Gives a gentle "welcome back"
 *  instead of silently logging a fake session. */
export function longGapWelcomeBack(db: Db, gapMinutes: number): void {
  const id = `gap-welcome-${Date.now()}`
  let body = `You were away for ${Math.round(gapMinutes)} min.`
  if (gapMinutes >= 60) {
    const h = Math.floor(gapMinutes / 60)
    body = `You were away for ${h} h.`
  }
  enqueueNotification(db, {
    id,
    kind: 'long-gap-welcome',
    title: 'Welcome back',
    body,
    tier: 'info',
    data: { gapMinutes },
  })
}

// ===========================================================================
// Background checker — called every 5 min from app.whenReady()
// ===========================================================================

/* Lead times before a deadline fires a notification. These were hardcoded
   1 day / 3 hours / 1 hour with no way to change them; the user now picks how
   far ahead to be warned. Defaults preserve the previous behaviour exactly. */
export const DEFAULT_TIER_MINUTES = { d1: 1440, h3: 180, h1: 60 };

type TierKey = 'd1' | 'h3' | 'h1';

/** Settings row -> tier minutes. Unknown/partial settings fall back per-tier so
    one bad value cannot silence every notification. */
export function resolveTierMinutes(db: Db): Record<TierKey, number> {
  const d = DEFAULT_TIER_MINUTES;
  let row: any = null;
  try {
    row = db.prepare(`SELECT value FROM app_settings WHERE key = 'reminder_lead_minutes'`).get();
  } catch { row = null; }
  let parsed: any = {};
  if (row?.value) { try { parsed = JSON.parse(row.value); } catch { parsed = {}; } }
  const num = (v: any, fallback: number) => {
    const n = Number(v);
    // 0 is meaningful (notify only at the due moment), so test finiteness not truthiness
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    d1: num(parsed?.d1, d.d1),
    h3: num(parsed?.h3, d.h3),
    h1: num(parsed?.h1, d.h1),
  };
}

function buildTiers(minutes: Record<TierKey, number>) {
  return (Object.keys(minutes) as TierKey[])
    // A tier configured to 0 means "don't warn this far ahead" — emitting a
    // 0ms tier would fire immediately for every deadline, so drop it.
    .filter(k => minutes[k] > 0)
    .map(k => ({ key: k, ms: minutes[k] * 60_000 }))
    .sort((a, b) => b.ms - a.ms);
}

const TIER_LABEL: Record<TierKey, string> = {
  d1: 'Due tomorrow',
  h3: '3 hours left',
  h1: '1 hour left',
};

/** "1 day before" — used in the notification title so it says WHY it fired. */
function leadLabel(leadMin: number): string {
  const min = Math.max(0, Math.trunc(Number(leadMin) || 0))
  if (min === 0) return 'due now'
  if (min < 60) return `${min}m before`
  if (min % (7 * 24 * 60) === 0) return `${min / (7 * 24 * 60)}w before`
  if (min % (24 * 60) === 0) return `${min / (24 * 60)}d before`
  if (min % 60 === 0) return `${min / 60}h before`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}m before`
}

/** How late a relative lead may get before we retire it instead of firing. */
const STALE_REMINDER_GRACE_MS = 5 * 60_000;

export function checkDeadlinesAndNotify(db: Db): void {
  if (!db) return;
  try {
  const now = Date.now()
  const rows = db.prepare(`
    SELECT * FROM deadlines
    WHERE status != 'done'
      AND (snoozed_until IS NULL OR snoozed_until <= ?)
  `).all(new Date().toISOString()) as any[]

  for (const row of rows) {
    const notified = JSON.parse(row.notified_at || '{}')

    // Exact-time reminder
    if (row.remind_at && !notified['remind_at']) {
      const remindTime = new Date(row.remind_at).getTime()
      if (now >= remindTime) {
        enqueueNotification(db, {
          id: `dl-remind-${row.id}`,
          kind: 'deadline',
          title: 'Reminder',
          body: `${row.title}${row.course ? ` · ${row.course}` : ''}`,
          tier: 'warn',
          data: { deadlineId: row.id, type: 'remind' },
        })
        notified['remind_at'] = true
        db.prepare(`UPDATE deadlines SET notified_at = ? WHERE id = ?`).run(JSON.stringify(notified), row.id)
        continue
      }
    }

    // Tiered urgency
    const due = new Date(row.due_date).getTime()
    if (Number.isFinite(due) && !notified['overdue']) {
      const overdueBy = now - due;
      const overdueByDays = Math.floor(overdueBy / 86_400_000);
      const overdueByHours = Math.floor(overdueBy / 3_600_000);
      const overdueByMins = Math.floor(overdueBy / 60_000);
      const late =
        overdueByDays >= 1 ? `${overdueByDays} day${overdueByDays === 1 ? '' : 's'} late`
        : overdueByHours >= 1 ? `${overdueByHours} hour${overdueByHours === 1 ? '' : 's'} late`
        : `${Math.max(1, overdueByMins)} min late`;
      enqueueNotification(db, {
        id: `dl-overdue-${row.id}`,
        kind: 'deadline',
        title: `Overdue — ${late}`,
        body: `${row.title}${row.course ? ` · ${row.course}` : ''}`,
        tier: 'urgent',
        data: { deadlineId: row.id, type: 'overdue' },
      });
      notified['overdue'] = true;
      db.prepare(`UPDATE deadlines SET notified_at = ? WHERE id = ?`).run(JSON.stringify(notified), row.id);
      continue;
    }
    const timeLeft = due - now
    for (const tier of buildTiers(resolveTierMinutes(db))) {
      if (timeLeft <= tier.ms && timeLeft > 0 && !notified[tier.key]) {
        const label = TIER_LABEL[tier.key] ?? `${Math.round(tier.ms / 3_600_000)} hours left`
        enqueueNotification(db, {
          id: `dl-${tier.key}-${row.id}`,
          kind: 'deadline',
          title: label,
          body: `${row.title}${row.course ? ` · ${row.course}` : ''}`,
          tier: 'warn',
          data: { deadlineId: row.id, type: 'tier', tier: tier.key },
        })
        notified[tier.key] = true
        db.prepare(`UPDATE deadlines SET notified_at = ? WHERE id = ?`).run(JSON.stringify(notified), row.id)
        break
      }
    }
  }
  /* ── Reminders as rows: relative leads AND absolute instants, many per
     deadline. This runs AFTER the legacy urgency block, and it is the one
     that actually covers the feature. Order is load-bearing, not cosmetic —
     see the note on re-reading `notified_at` below.

     Two things were quietly missing and both looked identical from the UI:
       1. `deadlines.remind_at` is ONE column, so a deadline could only ever
          remind you once — "a week out AND the morning of" was unstorable.
       2. A relative lead cannot be stored in an instant at all. Baked into a
          timestamp it goes stale the moment the deadline moves, and keeps
          firing relative to the OLD date. So `lead_min` is resolved against
          the deadline's CURRENT due date on every poll, which is what makes a
          rescheduled deadline drag its reminders along correctly.

     `fired` is the dedupe. It is set in the same statement that enqueues, and
     `INSERT OR IGNORE` on the notification id makes a double-tick harmless, so
     a race between two polls cannot produce two alerts. */
  try {
    const dueById = new Map<string, number>()
    for (const row of rows) {
      const raw = String(row.due_date || '')
      const t = new Date(raw.length > 10 ? raw : raw + 'T09:00:00').getTime()
      if (Number.isFinite(t)) dueById.set(row.id, t)
    }

    const pending = db.prepare(`
      SELECT r.id, r.deadline_id, r.mode, r.lead_min, r.remind_at
      FROM deadline_reminders r
      JOIN deadlines d ON d.id = r.deadline_id
      WHERE r.fired = 0
        AND d.status != 'done'
        AND (d.snoozed_until IS NULL OR d.snoozed_until <= ?)
    `).all(new Date().toISOString()) as any[]

    const fire = db.prepare('UPDATE deadline_reminders SET fired = 1 WHERE id = ? AND fired = 0')
    const markStmt = db.prepare('UPDATE deadlines SET notified_at = ? WHERE id = ?')

    for (const r of pending) {
      const row = rows.find(x => x.id === r.deadline_id)
      if (!row) continue

      let fireAt = Number.NaN
      if (r.mode === 'absolute') {
        fireAt = r.remind_at ? new Date(r.remind_at).getTime() : Number.NaN
      } else {
        const due = dueById.get(r.deadline_id)
        if (due === undefined) continue
        const lead = Number.isFinite(r.lead_min) ? Math.max(0, Math.trunc(r.lead_min)) : 0
        fireAt = due - lead * 60000
      }
      if (!Number.isFinite(fireAt) || now < fireAt) continue

      // Only claim it if nobody else got there first.
      if (fire.run(r.id).changes !== 1) continue

      /* A RELATIVE LEAD THAT HAS ALREADY MISSED ITS MOMENT IS SILENTLY RETIRED,
         NOT FIRED LATE. Adding is blocked at creation, but rescheduling can walk
         the deadline back under a lead: you asked to be reminded a day before,
         then moved the deadline to 20 minutes' time, and the honest alert is
         nothing — not "Reminder — 1d before" arriving 23 hours after the day it
         referred to. An alarm that goes off describing a moment that has passed
         is worse than no alarm, because it teaches you to ignore the ones that
         matter.

         Absolute reminders are exempt: an absolute time is a fixed appointment,
         so being late about it is still worth saying. */
      if (r.mode === 'relative' && now - fireAt > STALE_REMINDER_GRACE_MS) {
        const n0 = JSON.parse(
          (db.prepare('SELECT notified_at FROM deadlines WHERE id = ?').get(r.deadline_id) as any)?.notified_at || '{}',
        )
        n0[`rem_${r.id}`] = true
        markStmt.run(JSON.stringify(n0), r.deadline_id)
        continue
      }

      enqueueNotification(db, {
        id: `dl-rem-${r.id}`,
        kind: 'deadline',
        title: r.mode === 'relative' && r.lead_min > 0 ? `Reminder — ${leadLabel(r.lead_min)}` : 'Reminder',
        body: `${row.title}${row.course ? ` · ${row.course}` : ''}`,
        tier: 'warn',
        data: { deadlineId: r.deadline_id, reminderId: r.id, type: 'remind', mode: r.mode },
      })

      /* RE-READ, do not reuse the `row` snapshot. The legacy urgency block
         below also does a read-modify-write on `notified_at` for this same
         deadline. Two blocks reading one snapshot and each writing their own
         key means the second write silently drops the first, so the dropped
         key is never persisted and that notification fires again on every
         poll — forever. Measured: the two blocks overwrite each other's key,
         and a second tick duplicates an alert. So this block runs AFTER the
         legacy one and re-reads what was actually stored. */
      const fresh = JSON.parse(
        (db.prepare('SELECT notified_at FROM deadlines WHERE id = ?').get(r.deadline_id) as any)?.notified_at
        || '{}',
      )
      fresh[`rem_${r.id}`] = true
      markStmt.run(JSON.stringify(fresh), r.deadline_id)
    }
  } catch (e) {
    console.error('[DeskFlow] deadline_reminders firing error:', e)
  }
  } catch (e) {
    // A bare `catch { }` is what let an undefined `now` sit here silently,
    // killing every deadline/reminder notification with no trace. Log it.
    console.error('[DeskFlow] checkDeadlinesAndNotify failed:', e);
  }
}
