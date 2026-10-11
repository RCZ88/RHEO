import {
  KEEPALIVE_EXTEND_MS,
  KEEPALIVE_NULL_POLLS,
  MAX_LOGGED_SESSION_MS,
  MAX_SESSION_MS,
  SLEEP_GAP_MS,
  log,
  warn,
} from './config';
import { categorizeApp } from './categories';
import { commitLog } from './db';

/**
 * Port of pollForegroundInner() (src/main.ts:5624-5996) reduced to what a
 * single-writer daemon actually needs: app-change boundaries, sleep-gap
 * detection, keepalive across transient null polls, and a periodic flush so a
 * hard kill costs at most one flush interval rather than a whole session.
 *
 * What is deliberately NOT here: game poll-skip (GAME_POLL_SKIP=6), the
 * focus manager hook, trackerAppMode, and the browser-focus gate. The first two
 * are Electron-side concerns; the browser-focus gate reads renderer-owned
 * preferences the daemon deliberately does not duplicate.
 */

export interface Observation {
  app: string;
  title: string | null;
  category: string;
}

export interface Stats {
  polls: number;
  rowsWritten: number;
  lastRow: string | null;
  lastSuccessfulPollAt: string | null;
}

const stats: Stats = { polls: 0, rowsWritten: 0, lastRow: null, lastSuccessfulPollAt: null };

/**
 * Windows that are the desktop itself, not user activity. main.ts has a
 * Windows-only TRANSIENT_APPS list; this is the Linux equivalent, which did not
 * exist. Without it the daemon logs "plasmashell" and "krunner" as real usage.
 */
const SHELL_APPS = new Set([
  'plasmashell',
  'plasmashell_x11',
  'krunner',
  'ksmserver',
  'kwin_wayland',
  'kwin_x11',
  'gnome-shell',
  'xfce4-panel',
  'lxqt-panel',
  'tint2',
  'dwm',
  'sway',
  'swaylock',
  'xwayland',
  'xdg-desktop-portal',
  'xdg-desktop-portal-kde',
  'polkit-kde-authentication-agent',
  'kded5',
  'kded6',
  'kglobalaccel',
  'kactivitymanagerd',
  'tracker-miner-fs',
  'tracker-extract',
  'baloo_file',
  'baloorunner',
]);

/** The app and the daemon's own surface must never be logged as usage. */
const SELF_APPS = new Set(['electron', 'rheo', 'deskflow', 'rheo-tracker', 'node']);

export function normalizeApp(raw: string): string | null {
  const lower = (raw || '').trim().toLowerCase();
  if (!lower) return null;
  // kdotool on KDE reports the machine hostname as WM_CLASS when a window has no
  // real class set — linuxForeground.ts already refines those, but guard anyway.
  if (SHELL_APPS.has(lower)) return null;
  if (SELF_APPS.has(lower)) return null;
  return lower;
}

interface OpenSession {
  app: string;
  title: string | null;
  category: string;
  startedAtMs: number;
}

let open: OpenSession | null = null;
let lastPollMs = 0;
let lastFlushMs = 0;
let nullPolls = 0;
/** Linux has no working getSystemIdleTime(), so idle is derived from foreground change. */
let lastForegroundChangeMs = Date.now();

export function current(): { app: string | null; category: string | null; title: string | null } {
  return {
    app: open?.app ?? null,
    category: open?.category ?? null,
    title: open?.title ?? null,
  };
}

export function getStats(): Stats {
  return { ...stats };
}

/** Force the open session out to the DB. Safe to call when nothing is open. */
export function flush(reason: string): void {
  if (!open) return;
  const endedAtMs = lastPollMs || Date.now();
  const durationMs = endedAtMs - open.startedAtMs;
  const session = open;
  open = null;
  lastFlushMs = Date.now();
  if (durationMs < 1000) return; // sub-second fragments are noise

  const capped = Math.min(durationMs, MAX_LOGGED_SESSION_MS);
  const timestamp = new Date(session.startedAtMs).toISOString();
  const ok = commitLog(
    {
      timestamp,
      app: session.app,
      category: session.category,
      duration_ms: capped,
      title: session.title,
      is_browser_tracking: 0,
      platform: 'linux',
      source: 'auto',
    },
    {
      timestamp,
      app: session.app,
      category: session.category,
      duration_ms: capped,
      is_browser_tracking: 0,
    },
  );
  if (ok) {
    stats.rowsWritten++;
    stats.lastRow = `${session.app} ${Math.round(capped / 1000)}s`;
    log(`wrote ${session.app} ${Math.round(capped / 1000)}s (${reason})`);
  } else {
    warn(`dropped ${session.app} ${Math.round(capped / 1000)}s (${reason}) — DB write failed`);
  }
}

export function feed(observed: { app: string; title: string | null } | null): void {
  const now = Date.now();
  stats.polls++;
  const wallGap = now - lastPollMs;
  lastPollMs = now;

  // A wall-clock jump longer than the sleep threshold means the machine was
  // suspended. Do NOT backfill the gap — the user was asleep, not working, and
  // writing it would invent hours of activity.
  if (open && wallGap > SLEEP_GAP_MS) {
    flush(`sleep gap of ${Math.round(wallGap / 1000)}s`);
    warn(`detected a ${Math.round(wallGap / 60_000)} min gap — flushed without backfill`);
    open = null;
    nullPolls = 0;
  }

  if (!observed) {
    nullPolls++;
    // Transient compositor hiccups happen. Hold the session open briefly instead
    // of shredding it, but never indefinitely — a genuinely gone window must
    // eventually close so the next app's time is attributed correctly.
    if (open && nullPolls > KEEPALIVE_NULL_POLLS && now - lastForegroundChangeMs > KEEPALIVE_EXTEND_MS) {
      flush(`window absent for ${nullPolls} polls`);
    }
    return;
  }

  const appChanged = !open || open.app !== observed.app;
  if (appChanged) {
    flush('app changed');
    lastForegroundChangeMs = now;
    nullPolls = 0;
    open = {
      app: observed.app,
      title: observed.title,
      category: categorizeApp(observed.app),
      startedAtMs: now,
    };
    return;
  }

  // Unreachable in practice — appChanged is true whenever open is null — but the
  // sleep-gap branch above can leave open null without returning, so narrow
  // explicitly rather than letting a null deref kill the poll loop.
  if (!open) {
    open = {
      app: observed.app,
      title: observed.title,
      category: categorizeApp(observed.app),
      startedAtMs: now,
    };
    return;
  }

  nullPolls = 0;
  stats.lastSuccessfulPollAt = new Date(now).toISOString();

  // Bind to a local. `open` is module state that flush() reassigns to null, so
  // every field read below must come from this snapshot, not from `open`.
  // Reading open.category after flush() threw once per flush interval — i.e.
  // exactly on the long sessions this daemon exists to survive.
  const carried: OpenSession = open;
  carried.title = observed.title;

  // Long-session boundary and periodic durability checkpoint.
  if (now - carried.startedAtMs >= MAX_SESSION_MS || now - lastFlushMs >= 60_000) {
    flush('periodic checkpoint');
    open = {
      app: observed.app,
      title: observed.title,
      category: carried.category,
      startedAtMs: now,
    };
  }
}

export function reset(): void {
  flush('ownership handover');
  open = null;
  nullPolls = 0;
  lastPollMs = 0;
  lastFlushMs = 0;
  lastForegroundChangeMs = Date.now();
}