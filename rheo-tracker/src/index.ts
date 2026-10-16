import * as http from 'node:http';
import { getLinuxForegroundWindow, probeLinuxTrackingEnvironment } from '../../src/linuxForeground';
import {
  DB_PATH,
  OWNERSHIP_CHECK_INTERVAL_MS,
  POLL_INTERVAL_MS,
  STATE_FLUSH_INTERVAL_MS,
  USER_DATA,
  USER_DATA_SOURCE,
  log,
  warn,
} from './config';
import { flushCategories, loadCategories } from './categories';
import { closeDb, openDb } from './db';
import { startBrowserServer, stopBrowserServer } from './browserServer';
import {
  acquireLock,
  appMarkerIsOverridden,
  isAppRunning,
  releaseLock,
  writeHeartbeat,
} from './ownership';
import type { HeartbeatPatch } from './ownership';
import * as session from './session';
import * as path from 'node:path';
import * as fs from 'node:fs';

(globalThis as Record<string, unknown>).__rheoTrackerBootedAt = new Date().toISOString();

// ── Single instance ──────────────────────────────────────────────────────────
if (!acquireLock()) {
  log('another instance owns the lock — exiting cleanly');
  process.exit(0);
}

log('booting — linux/wayland foreground tracker, no Electron, no network mount');
if (appMarkerIsOverridden()) {
  warn('RHEO_TRACKER_APP_MARKER is set — app detection is FORCED by that substring. Offline verification only.');
}
log(`profile     ${USER_DATA}`);
log(`            (resolved from: ${USER_DATA_SOURCE})`);
log(`database    ${DB_PATH}`);

// Capability probe is diagnostic only — a failure here must never stop tracking.
try {
  const env = await probeLinuxTrackingEnvironment();
  log(`session=${env.sessionType} desktop=${env.currentDesktop} note="${env.note}"`);
  if (env.sessionType === 'wayland' && env.tools && !env.tools.kdotool && !env.tools.hyprctl) {
    warn('Wayland with no compositor-native tool available — native windows will NOT be visible');
  }
} catch (err) {
  warn('environment probe failed:', (err as Error).message);
}

loadCategories(true);
if (!openDb()) {
  warn('DB unavailable at boot — will retry each poll');
}

// ── Browser ingest ───────────────────────────────────────────────────────────
let browserServer: http.Server | null = null;

// ── Ownership ────────────────────────────────────────────────────────────────
// A single-writer state machine that acts only on TRANSITIONS. The earlier
// version re-evaluated and re-logged on every 1s poll, which is correct but
// produced one "standing down" line per second — ~86,000 lines a day in the
// journal, enough to make `journalctl -u` useless and to grow the log unbounded.
let owning = false;
let announced = false;
let lastOwnershipCheck = 0;
let pollTimer: NodeJS.Timeout | null = null;

/** Single place that knows how session state maps onto the heartbeat shape. */
function heartbeatPatch(reason: string, active: boolean): HeartbeatPatch {
  const state = session.current();
  const st = session.getStats();
  return {
    reason,
    active,
    currentApp: state.app,
    currentCategory: state.category,
    lastSuccessfulPollAt: st.lastSuccessfulPollAt,
    polls: st.polls,
    rowsWritten: st.rowsWritten,
  };
}

// ── AFK event queue (daemon → app) ────────────────────────────────────────────
// The app polls this file to detect AFK start/end events and show the gap-fill prompt.
const AFK_EVENT_QUEUE = path.join(USER_DATA, 'tracker-afk-events.jsonl');

function enqueueAfkEvent(event: session.AfkEvent): void {
  try {
    fs.appendFileSync(AFK_EVENT_QUEUE, JSON.stringify(event) + '\n', 'utf8');
  } catch (err) {
    warn('failed to enqueue AFK event:', (err as Error).message);
  }
}

async function applyOwnership(own: boolean, reason: string): Promise<void> {
  // Announce on the FIRST evaluation as well as on every later transition. With
  // `owning` seeded to false and a bare equality guard, the initial stand-down was
  // silent — the daemon would sit there tracking nothing and journalctl would show
  // nothing but "tracking loop running".
  if (own === owning && announced) return;
  announced = true;
  owning = own;
  if (own) {
    loadCategories(true);
    // Awaited but never trusted to succeed: an unavailable port must degrade
    // browser tracking only, never stop foreground tracking.
    browserServer = await startBrowserServer();
    log(`tracking ACTIVE — ${reason}`);
  } else {
    // Flush BEFORE standing down so the last seconds are not lost and never
    // overlap the app's own poll loop.
    session.reset();
    await stopBrowserServer(browserServer);
    browserServer = null;
    log(`tracking IDLE — ${reason}`);
  }
  await writeHeartbeat(heartbeatPatch(reason, owning)).catch(() => undefined);
}

async function claimOwnershipIfFree(): Promise<void> {
  const now = Date.now();
  // Rate-limit the check itself, in BOTH directions. Polling /proc for every
  // Electron process once a second is wasted work while standing down.
  if (now - lastOwnershipCheck < OWNERSHIP_CHECK_INTERVAL_MS) return;
  lastOwnershipCheck = now;

  const appUp = isAppRunning();
  if (appUp) {
    await applyOwnership(false, 'RHEO app is running and owns tracking');
  } else if (!owning) {
    await applyOwnership(true, 'RHEO app absent, tracking in background');
  }
  if (!owning) return;
}

await claimOwnershipIfFree();

// Register AFK event handler — writes events to a queue file the app polls.
session.onAfkEvent((event) => {
  enqueueAfkEvent(event);
});

// ── Poll loop ────────────────────────────────────────────────────────────────
async function tick(): Promise<void> {
  await claimOwnershipIfFree();
  if (!owning) return;
  try {
    loadCategories();
    const win = await getLinuxForegroundWindow();
    const app = win?.owner?.name ? session.normalizeApp(win.owner.name) : null;
    session.feed(app ? { app, title: win?.title ?? null } : null);
  } catch (err) {
    warn('poll failed:', (err as Error).message);
  }
}

pollTimer = setInterval(() => {
  void tick();
}, POLL_INTERVAL_MS);

// ── Heartbeat ────────────────────────────────────────────────────────────────
setInterval(() => {
  void writeHeartbeat(
    heartbeatPatch(owning ? 'tracking in background' : 'rheo app owns tracking', owning),
  ).catch(() => {
    /* never let a heartbeat write kill the loop */
  });
}, 5000);

// Categories are flushed on a slow cadence so a crash costs at most one interval
// and the shared JSON is not rewritten on every tick.
setInterval(() => {
  void flushCategories().catch(() => undefined);
}, STATE_FLUSH_INTERVAL_MS);

// ── Shutdown ─────────────────────────────────────────────────────────────────
// SIGTERM is what systemd sends. Flush the open session BEFORE closing the DB,
// or the last few minutes of real work vanish.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal} — flushing and exiting`);
  try {
    session.flush(`daemon ${signal}`);
    await flushCategories();
    await stopBrowserServer(browserServer);
  } catch (err) {
    warn('shutdown flush error:', (err as Error).message);
  }
  if (pollTimer) clearInterval(pollTimer);
  closeDb();
  releaseLock();
  // Read the counters AFTER the flush above, or the shutdown heartbeat reports the
  // session it just wrote as zero rows.
  await writeHeartbeat(heartbeatPatch(`daemon stopped (${signal})`, false)).catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  // Without this, one transient fault ends the session and loses everything
  // since the last checkpoint.
  warn('uncaughtException:', err.message);
  try {
    session.flush('uncaughtException');
  } catch {
    /* ignore */
  }
});
process.on('unhandledRejection', (reason) => {
  warn('unhandledRejection:', reason instanceof Error ? reason.message : String(reason));
});

// EPIPE on stdout kills the process when the journal rotates.
process.stdout.on('error', () => undefined);
process.stderr.on('error', () => undefined);

void tick();
log('tracking loop running');