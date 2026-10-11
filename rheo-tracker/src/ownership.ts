import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { LOCK_PATH, STATE_PATH, log, warn } from './config';

/**
 * Ownership model (Option B — "daemon stands down while the app is live").
 *
 * Exactly one writer at a time. The desktop app is authoritative whenever it is
 * running, because it owns the tracking state machine, the focus manager and the
 * browser server. The daemon only fills the gap.
 *
 * App detection deliberately does NOT use `pgrep -f`: a shell whose own command
 * line contains the search pattern matches itself, which makes the daemon
 * believe the app is up forever and never track. Reading each process's cmdline
 * under /proc has no self-match and no subprocess to leak.
 */
const APP_CMDLINE_MARKERS = ['dist-electron/main.cjs', 'dist-electron/main.js'];

/**
 * Offline-verification seam. When set, detection looks for THIS substring in any
 * process argv instead of resolving Electron by executable name. Pointing it at a
 * string that no real process carries makes `isAppRunning()` deterministically
 * false, which is the only way to exercise the tracking path while the real app
 * is running and must not be stopped. Logged loudly at boot so it can never be
 * left set by accident.
 */
const MARKER_OVERRIDE = (process.env.RHEO_TRACKER_APP_MARKER || '').trim();

export function appMarkerIsOverridden(): boolean {
  return MARKER_OVERRIDE.length > 0;
}

function selfPid(): number {
  return process.pid;
}

/**
 * Executable basenames that mean "the RHEO app is running".
 *
 * BOTH forms matter, and missing the second one is a live double-counting bug:
 *   - `electron` — the DEV app (`npm start`), argv[0] is node_modules/electron/dist/electron
 *   - `rheo`     — a PACKAGED app, where electron-builder renames the binary to
 *                  `productName`. On Windows that is `RHEO.exe`, on a Linux AppImage
 *                  or installed build `rheo`.
 *
 * The packaged form was originally missing, which meant the ownership check could
 * not see a packaged RHEO at all: the daemon would conclude "app absent", claim
 * tracking AND bind port 54321, while the app's own loop ran too. Every second of
 * use would be recorded twice.
 */
const APP_EXECUTABLES = new Set([
  'electron',
  'electron.exe',
  'rheo',
  'rheo.exe',
]);

function isElectronExecutable(argv0: string): boolean {
  if (!argv0) return false;
  // Split on BOTH separators: a Windows path yields a basename of
  // 'C:\Program Files\RHEO\RHEO.exe' if only '/' is handled, and 'RHEO' if only
  // '\' is. Cheap to be correct about both.
  const base = (argv0.split(/[/\\]/).pop() || argv0).toLowerCase();
  return APP_EXECUTABLES.has(base);
}

function isChildProcess(argv: string[]): boolean {
  // --type=zygote / renderer / gpu-process / utility are Electron's own children.
  // The browser parent is the one that decides whether the app is running.
  return argv.some((a) => a.startsWith('--type='));
}

/**
 * True when the RHEO app process is alive — packaged OR dev.
 *
 * Detected on argv[0] (the executable path), never on a substring of the whole
 * command line, for two reasons both learned the hard way:
 *
 *  1. A substring match on `dist-electron/main.cjs` matched NOTHING. The dev app is
 *     launched `electron --ozone-platform=x11 --user-data-dir=... .` — Electron
 *     resolves `main` from package.json internally, so that path never appears in
 *     argv. It reported "app not running" while the app held port 54321.
 *  2. A looser substring match then matches any SHELL whose command line happens
 *     to contain the word — including this file's own grep. Anchoring to argv[0]
 *     cannot match a shell.
 */
export function isAppRunning(): boolean {
  const me = selfPid();
  let entries: string[];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return false;
  }
  for (const entry of entries) {
    const pid = Number(entry);
    if (!Number.isInteger(pid) || pid === me) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      continue; // process exited between readdir and read
    }
    if (!raw) continue;
    const argv = raw.split('\0').filter(Boolean);
    if (argv.length === 0) continue;
    if (MARKER_OVERRIDE) {
      // Test seam: any argument carrying the marker counts, regardless of position.
      if (argv.some((a) => a.includes(MARKER_OVERRIDE))) return true;
      continue;
    }
    if (isChildProcess(argv)) continue;
    // Packaged/asar builds expose the main script directly.
    // The marker is matched against argv[0] ONLY, never against any later
    // argument. Matching every argument meant any shell, editor, or agent whose
    // command line merely MENTIONED dist-electron/main.cjs counted as "the app is
    // running" — including a `ps | grep electron` one-liner and the daemon's own
    // test harness. That makes the daemon stand down forever while tracking
    // nothing, which is the exact failure this whole component exists to prevent.
    if (APP_CMDLINE_MARKERS.some((m) => argv[0].includes(m))) return true;
    if (isElectronExecutable(argv[0])) return true;
  }
  return false;
}

// ── Single-instance lock ─────────────────────────────────────────────────────
// systemd already runs one unit, but the daemon must also survive being started
// by hand while the service runs, so it takes its own advisory lock.
let lockFd: number | null = null;

export function acquireLock(): boolean {
  if (lockFd !== null) return true;
  try {
    lockFd = fs.openSync(LOCK_PATH, 'wx');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'EEXIST') {
      warn('lock open failed:', e.message);
      return false;
    }
    // A stale lock from a hard kill must not wedge the daemon forever. If the
    // recorded pid is gone, take it over; if it is alive, stand down.
    try {
      const raw = fs.readFileSync(LOCK_PATH, 'utf8');
      const pid = Number(raw.trim());
      if (Number.isInteger(pid) && pid > 0 && pid !== selfPid() && isPidAlive(pid)) {
        warn(`another daemon holds the lock (pid ${pid}) — exiting`);
        return false;
      }
      warn(`clearing stale lock from dead pid ${pid || 'unknown'}`);
      fs.unlinkSync(LOCK_PATH);
      lockFd = fs.openSync(LOCK_PATH, 'wx');
    } catch (retryErr) {
      warn('stale-lock recovery failed:', (retryErr as Error).message);
      return false;
    }
  }
  try {
    fs.writeSync(lockFd, String(selfPid()));
  } catch {
    /* advisory only */
  }
  return true;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function releaseLock(): void {
  if (lockFd === null) return;
  try {
    fs.closeSync(lockFd);
  } catch {
    /* ignore */
  }
  try {
    if (fs.readFileSync(LOCK_PATH, 'utf8').trim() === String(selfPid())) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch {
    /* ignore */
  }
  lockFd = null;
}

// ── Heartbeat ────────────────────────────────────────────────────────────────
export interface Heartbeat {
  pid: number;
  bootedAt: string;
  updatedAt: string;
  active: boolean;
  reason: string;
  currentApp: string | null;
  currentCategory: string | null;
  lastSuccessfulPollAt: string | null;
  polls: number;
  rowsWritten: number;
}

export interface HeartbeatPatch {
  reason: string;
  active: boolean;
  currentApp?: string | null;
  currentCategory?: string | null;
  lastSuccessfulPollAt?: string | null;
  polls?: number;
  rowsWritten?: number;
}

export async function writeHeartbeat(patch: HeartbeatPatch): Promise<void> {
  const now = new Date().toISOString();
  // Fields are copied by NAME, never by spreading a caller object. A blind spread
  // of session.current() supplied `app`/`category`/`title`, which are not keys of
  // Heartbeat, so `currentApp` and `currentCategory` silently stayed null — and a
  // heartbeat that reports rowsWritten: 0 after writing four rows is worse than no
  // heartbeat, because it looks like the tracker is dead.
  const body: Heartbeat = {
    pid: selfPid(),
    bootedAt: String((globalThis as Record<string, unknown>).__rheoTrackerBootedAt || now),
    updatedAt: now,
    currentApp: patch.currentApp ?? null,
    currentCategory: patch.currentCategory ?? null,
    lastSuccessfulPollAt: patch.lastSuccessfulPollAt ?? null,
    polls: patch.polls ?? 0,
    rowsWritten: patch.rowsWritten ?? 0,
    active: patch.active,
    reason: patch.reason,
  };
  // Write-then-rename: a reader must never observe a half-written JSON file.
  const tmp = `${STATE_PATH}.${selfPid()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(body, null, 2), 'utf8');
  await fsp.rename(tmp, STATE_PATH);
}


/** Stands the daemon down when the app takes over. Flushes on the transition. */
export function logOwnership(active: boolean, reason: string): void {
  log(active ? `tracking ACTIVE — ${reason}` : `tracking IDLE — ${reason}`);
}