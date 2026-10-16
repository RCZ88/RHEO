import * as path from 'node:path';
import { dbFile, resolveUserData } from './userdata';

// ── Paths ────────────────────────────────────────────────────────────────────
// The daemon NEVER hardcodes a profile path. It resolves the SAME userData
// directory the app actually uses — see userdata.ts for why that is not
// ~/.config/RHEO, and what happens when it is guessed.
const RESOLVED = resolveUserData();
export const USER_DATA = RESOLVED.dir;
export const USER_DATA_SOURCE = RESOLVED.source;
export const DB_PATH = dbFile(USER_DATA);
export const CATEGORIES_PATH = path.join(USER_DATA, 'deskflow-categories.json');
export const STATE_PATH = path.join(USER_DATA, 'tracker-daemon.json');
export const LOCK_PATH = path.join(USER_DATA, 'tracker-daemon.lock');

// ── Poll cadence ─────────────────────────────────────────────────────────────
export const POLL_INTERVAL_MS = Number(process.env.RHEO_TRACKER_POLL_MS || 1000);
export const STATE_FLUSH_INTERVAL_MS = 60_000;
export const OWNERSHIP_CHECK_INTERVAL_MS = 10_000;

// ── Session boundaries ───────────────────────────────────────────────────────
// Mirrors src/main.ts:5066-5071 so history stays comparable with app-written rows.
export const MAX_SESSION_MS = 120 * 60_000;
export const MAX_LOGGED_SESSION_MS = 60 * 60_000;
export const SLEEP_GAP_MS = 5 * 60_000;

// AFK detection: if no foreground change for this long, consider user AFK.
// Matches app's afkThresholdSeconds (default 5 min, synced via userPreferences).
export const AFK_THRESHOLD_MS = 5 * 60_000;

// Null-poll budgets, also from src/main.ts:5069-5070. Once the window is absent
// for this many consecutive polls we hold the last app open as "keepalive"
// rather than closing the session, because a transient compositor hiccup must
// not shred a 40-minute session into a row per second.
export const KEEPALIVE_NULL_POLLS = 5;
export const KEEPALIVE_EXTEND_MS = 90_000;

// ── Browser ingest ───────────────────────────────────────────────────────────
export const BROWSER_PORT = Number(process.env.RHEO_TRACKER_PORT || 54321);

// ── Logging ──────────────────────────────────────────────────────────────────
const LOG_PREFIX = '[rheo-tracker]';
export function log(...args: unknown[]): void {
  // stdout is the systemd journal. Never let a closed pipe kill the daemon.
  try {
    console.log(LOG_PREFIX, ...args);
  } catch {
    /* stdout closed — drop the line, never throw */
  }
}
export function warn(...args: unknown[]): void {
  try {
    console.warn(LOG_PREFIX, ...args);
  } catch {
    /* see above */
  }
}