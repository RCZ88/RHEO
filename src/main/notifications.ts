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
import { execSync } from 'child_process'

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

    if (canUseElectronNotification()) {
      // Windows / macOS, or Linux with a working DBus notification daemon.
      new Notification({
        title: n.title,
        body: n.body,
        icon,
        sound: n.tier === 'error' || n.tier === 'warn',
      }).show()
    } else if (process.platform === 'linux') {
      // No DBus notification daemon — fall back to notify-send CLI.
      sendNotifySend(n.title, n.body, icon)
    }
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

const TIERS = [
  { key: '1d', ms: 86400000 },
  { key: '3h', ms: 10800000 },
  { key: '1h', ms: 3600000 },
]

export function checkDeadlinesAndNotify(db: Db): void {
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
    const timeLeft = due - now
    for (const tier of TIERS) {
      if (timeLeft <= tier.ms && timeLeft > 0 && !notified[tier.key]) {
        const label = tier.key === '1d' ? 'Due tomorrow' : tier.key === '3h' ? '3 hours left' : '1 hour left'
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
}
