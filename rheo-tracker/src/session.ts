import {
  AFK_THRESHOLD_MS,
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
import { getSystemInputIdleMs } from '../../src/systemInputIdle';
import { canonicalAppName } from '../../src/shared/appIdentity';

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

/**
 * Desktop shell / window manager processes — not user activity.
 *
 * Matched by SUBSTRING, not exact Set.has(). KDE reports reverse-DNS ids with
 * suffixes (`org.kde.polkit-kde-authentication-agent-1`) and the old exact
 * lookup let them through as "usage". The app's TRANSIENT_APPS already works
 * this way; two writers must agree on what counts as an app.
 */
const SHELL_APPS = [
  'plasmashell', 'krunner', 'ksmserver', 'kwin',
  'gnome-shell', 'xfce4-panel', 'lxqt-panel', 'tint2', 'dwm', 'sway',
  'xwayland', 'xdg-desktop-portal', 'xdg-document-portal', 'xdg-permission-store',
  'polkit', 'kded', 'kglobalaccel', 'kactivitymanagerd',
  'tracker-miner-fs', 'tracker-extract', 'baloo',
  'ksecretd', 'systemsettings', 'plasma-systemmonitor',
] as const;

/** The app and daemon themselves must never be logged as usage. */
const SELF_APPS = new Set(['electron', 'rheo', 'deskflow', 'rheo-tracker', 'node']);

/**
 * Normalize and filter app names. Returns null for shell/desktop apps that
 * should not be tracked as user activity.
 *
 * Alias resolution happens BEFORE the checks so `org.kde.dolphin` and `dolphin`
 * are one identity, not two sessions that alternate every time the foreground
 * detector falls back from kdotool to X11.
 */
export function normalizeApp(raw: string): string | null {
  const lower = (raw || '').trim().toLowerCase();
  if (!lower) return null;

  const canonical = canonicalAppName(lower);
  if (SHELL_APPS.some((app) => canonical.includes(app))) return null;
  if (SELF_APPS.has(canonical)) return null;
  return canonical;
}

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

export interface AfkEvent {
  type: 'afk_start' | 'afk_end';
  timestamp: string;
  afkStartMs: number;
  afkEndMs?: number;
  durationMs?: number;
}

const stats: Stats = { polls: 0, rowsWritten: 0, lastRow: null, lastSuccessfulPollAt: null };

// ── AFK detection state ───────────────────────────────────────────────────────
type AfkState = 'active' | 'afk';

let afkState: AfkState = 'active';
let afkStartMs = 0;
let afkEventCallback: ((event: AfkEvent) => void) | null = null;

/**
 * Subscribe to AFK events. The daemon will call this when AFK starts/ends.
 * The app can use this to show the gap-fill prompt.
 */
export function onAfkEvent(callback: (event: AfkEvent) => void): void {
  afkEventCallback = callback;
}

function emitAfkEvent(event: AfkEvent): void {
  if (afkEventCallback) {
    try {
      afkEventCallback(event);
    } catch (err) {
      warn('AFK event callback failed:', (err as Error).message);
    }
  }
}

export function current(): { app: string | null; category: string | null; title: string | null } {
  return {
    app: open?.app ?? null,
    category: open?.category ?? null,
    title: open?.title ?? null,
  };
}

interface OpenSession {
  app: string;
  title: string | null;
  category: string;
  startedAtMs: number;
}

let open: OpenSession | null = null;
// TWO CLOCKS. An attempt is not an observation: a failed poll, an unreadable
// compositor, or a suspended machine must never advance the endpoint of a
// credited session. `lastPollMs` conflated the two and turned every sleep into
// a plausible-looking hour of work.
let lastPollAttemptMs = 0;
let lastSuccessfulObservationMs = 0;
let lastFlushMs = 0;
let nullPolls = 0;
let lastForegroundChangeMs = Date.now();

export function getStats(): Stats {
  return { ...stats };
}

/** Force the open session out to the DB. Safe to call when nothing is open.
 *
 *  `endedAtMs` is EXPLICIT on purpose. It must never be derived from the
 *  attempted-poll clock, because that clock keeps moving across a suspend —
 *  which is exactly how a three-hour sleep used to become a one-hour session.
 *  The default is the last SUCCESSFUL observation, so unobserved time is never
 *  credited, and a session that never had a successful observation credits
 *  nothing at all. */
export function flush(reason: string, endedAtMs?: number): void {
  if (!open) return;
  const session = open;
  const stopAt = Number.isFinite(endedAtMs)
    ? (endedAtMs as number)
    : (lastSuccessfulObservationMs || session.startedAtMs);
  open = null;
  lastFlushMs = Date.now();
  const durationMs = stopAt - session.startedAtMs;
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

export function feed(result: { ok: boolean; observation: { app: string; title: string | null } | null }): void {
  const now = Date.now();
  stats.polls++;
  const wallGap = lastPollAttemptMs === 0 ? 0 : now - lastPollAttemptMs;

  // A wall-clock jump longer than the sleep threshold means the machine was
  // suspended. Detect it BEFORE the attempt clock advances, and flush at the
  // last SUCCESSFUL observation — never at `now`. Do not backfill the gap: the
  // user was asleep, not working.
  if (open && wallGap > SLEEP_GAP_MS) {
    flush(`sleep gap of ${Math.round(wallGap / 1000)}s`, lastSuccessfulObservationMs);
    warn(`detected a ${Math.round(wallGap / 60_000)} min gap — flushed without backfill`);
    open = null;
    nullPolls = 0;
    // Keep the AFK event stream balanced (every start has an end), but end the
    // absence at the last observation, not at wake time.
    if (afkState === 'afk') {
      const afkEndMs = lastSuccessfulObservationMs || now;
      if (afkEndMs > afkStartMs) {
        emitAfkEvent({
          type: 'afk_end',
          timestamp: new Date(afkEndMs).toISOString(),
          afkStartMs,
          afkEndMs,
          durationMs: afkEndMs - afkStartMs,
        });
      }
      afkState = 'active';
      afkStartMs = 0;
    }
  }
  lastPollAttemptMs = now;

  // A FAILED POLL IS NOT AN OBSERVATION. It may not move the success clock, or
  // the next flush would credit the very interval we could not observe.
  if (result.ok !== true) return;
  lastSuccessfulObservationMs = now;
  const observed = result.observation;

  // ── AFK detection ────────────────────────────────────────────────────────
  // Uses the device-wide input clock whenever the kernel devices are readable:
  // that is "seconds since a human last touched the machine", independent of
  // which window is focused. Foreground recency is the fallback for machines
  // where /dev/input is not accessible.
  const inputIdleMs = getSystemInputIdleMs();
  const idleMs = inputIdleMs !== null
    ? inputIdleMs
    : Math.max(0, now - lastForegroundChangeMs);
  if (afkState === 'active' && idleMs >= AFK_THRESHOLD_MS) {
    afkState = 'afk';
    // The absence began when the last real input happened.
    afkStartMs = now - idleMs;
    if (open) {
      flush(`AFK detected after ${Math.round(idleMs / 60_000)} min idle`, lastSuccessfulObservationMs);
    }
    emitAfkEvent({
      type: 'afk_start',
      timestamp: new Date(afkStartMs).toISOString(),
      afkStartMs,
    });
    log(`AFK started at ${new Date(afkStartMs).toISOString()}`);
    // STOP HERE. Falling through would hit the "open a session for the observed
    // app" branch and immediately count AFK time — the exact opposite of the
    // contract. No session exists until input returns.
    return;
  }

  // ── AFK END: ANY DEVICE INPUT ────────────────────────────────────────────
  // The old rule required a DIFFERENT app to become focused, so returning to the
  // window that was already open — or simply typing after a break — stayed AFK
  // indefinitely. Real input ends the absence directly, even when the poll has
  // no window observation at all.
  if (afkState === 'afk' && idleMs < AFK_THRESHOLD_MS) {
    const afkEndMs = now;
    const durationMs = Math.max(0, afkEndMs - afkStartMs);
    emitAfkEvent({
      type: 'afk_end',
      timestamp: new Date(afkEndMs).toISOString(),
      afkStartMs,
      afkEndMs,
      durationMs,
    });
    log(`AFK ended after ${Math.round(durationMs / 60_000)} min, resuming tracking`);
    afkState = 'active';
    afkStartMs = 0;
    nullPolls = 0;
    // Start a fresh session from the observation that follows the input. If the
    // compositor cannot see a window this tick, stay closed until it can.
    open = observed
      ? {
          app: observed.app,
          title: observed.title,
          category: categorizeApp(observed.app),
          startedAtMs: now,
        }
      : null;
    return;
  }

  // STILL AFK. The enter branch above only runs on the transition, so every
  // later tick would otherwise fall through to the "open a session for the
  // observed app" branch and count the absence as work. No session may exist
  // between afk_start and afk_end.
  if (afkState === 'afk') return;

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
  lastPollAttemptMs = 0;
  lastSuccessfulObservationMs = 0;
  lastFlushMs = 0;
  lastForegroundChangeMs = Date.now();
  // If the app opens while the daemon is mid-AFK, emit afk_end so the events
  // file stays balanced (every afk_start has a matching afk_end). Without this,
  // the app polls a dangling afk_start and may double-prompt or mis-fill.
  if (afkState === 'afk') {
    const afkEndMs = Date.now();
    const durationMs = afkEndMs - afkStartMs;
    emitAfkEvent({
      type: 'afk_end',
      timestamp: new Date(afkEndMs).toISOString(),
      afkStartMs,
      afkEndMs,
      durationMs,
    });
    log(`AFK ended after ${Math.round(durationMs / 60_000)} min (app opened)`);
    afkState = 'active';
    afkStartMs = 0;
  }
}