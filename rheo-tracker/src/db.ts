import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, MAX_LOGGED_SESSION_MS, log, warn } from './config';

/**
 * Uses node:sqlite (built into Node 22+), NOT the repo's better-sqlite3.
 *
 * The repo copy of better-sqlite3 is a native module compiled for Electron's ABI
 * (NODE_MODULE_VERSION 145). This machine's system Node is v26 (ABI 147), so
 * requiring it throws ERR_DLOPEN_FAILED — verified, not theoretical. The daemon
 * therefore depends on nothing outside the Node standard library: no npm install,
 * no node_modules on the Linux partition, no native rebuild to go stale.
 *
 * The app opens the same DB in WAL mode with busy_timeout=5000, which lets one
 * reader and one writer coexist. That is what makes the ownership handoff safe.
 */

let db: DatabaseSync | null = null;

export function openDb(): DatabaseSync | null {
  if (db) return db;
  try {
    // Same refusal the app applies (BackupService.ts:100): never let a bad path
    // resolution point at a build directory or inside an asar.
    if (/dist-electron|app\.asar|resources/i.test(DB_PATH)) {
      warn(`refusing to open suspicious DB path: ${DB_PATH}`);
      return null;
    }
    const d = new DatabaseSync(DB_PATH);
    d.exec('PRAGMA journal_mode = WAL');
    d.exec('PRAGMA busy_timeout = 5000');
    d.exec('PRAGMA synchronous = FULL');
    d.exec('PRAGMA foreign_keys = ON');
    const { integrity_check: integrity } = d.prepare('PRAGMA integrity_check').get() as {
      integrity_check: string;
    };
    if (integrity !== 'ok') {
      warn(`integrity_check returned "${integrity}" — not opening`);
      d.close();
      return null;
    }
    db = d;
    log(`opened ${DB_PATH}`);
    return db;
  } catch (err) {
    warn('could not open DB:', (err as Error).message);
    return null;
  }
}

export function closeDb(): void {
  try {
    db?.close();
  } catch {
    /* ignore */
  }
  db = null;
}

export interface LogRow {
  timestamp: string;
  app: string;
  category: string;
  duration_ms: number;
  title?: string | null;
  project?: string | null;
  url?: string | null;
  domain?: string | null;
  tab_id?: number | null;
  is_browser_tracking?: number;
  platform?: string | null;
  source?: string;
}

/**
 * Mirrors addLog() from src/main.ts:4790-4840, including the MAX_LOGGED_SESSION_MS
 * clamp. stats_hourly / stats_daily / app_totals are maintained by the table's own
 * AFTER INSERT triggers, so this single INSERT is enough for every report to stay
 * correct — writing them here too would double-count.
 */
export function addLog(row: LogRow): boolean {
  const d = openDb();
  if (!d) return false;
  const safeDuration = Math.min(Math.max(0, Math.floor(row.duration_ms)), MAX_LOGGED_SESSION_MS);
  if (safeDuration <= 0) return false;
  try {
    d.prepare(
      `INSERT INTO logs
         (timestamp, app, category, duration_ms, title, project, url, domain,
          tab_id, is_browser_tracking, platform, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.timestamp,
      row.app,
      row.category,
      safeDuration,
      row.title ?? null,
      row.project ?? null,
      row.url ?? null,
      row.domain ?? null,
      row.tab_id ?? null,
      row.is_browser_tracking ?? 0,
      row.platform ?? process.platform,
      row.source ?? 'auto',
    );
    return true;
  } catch (err) {
    warn('addLog failed:', (err as Error).message);
    return false;
  }
}

/**
 * Mirrors updateAggregates() from src/main.ts:4843-4900.
 *
 * The website-row guard is load-bearing: a domain row is a PORTION of the browser
 * app's time, so letting it touch daily_stats / sessions / daily_aggregates
 * counts the browser twice. It only feeds browser_sessions and (via triggers) the
 * domain rows in stats_daily / stats_hourly.
 */
export function updateAggregates(args: {
  timestamp: string;
  app: string;
  category: string;
  duration_ms: number;
  domain?: string | null;
  is_browser_tracking?: number;
}): void {
  const d = openDb();
  if (!d) return;
  const date = args.timestamp.split('T')[0];
  const durationSec = Math.floor(Math.min(args.duration_ms, MAX_LOGGED_SESSION_MS) / 1000);
  if (durationSec <= 0) return;
  const isWebsiteRow = args.is_browser_tracking === 1 && !!args.domain;

  try {
    if (!isWebsiteRow) {
      const existingDaily = d
        .prepare('SELECT id, total_sec FROM daily_stats WHERE date = ? AND app = ?')
        .get(date, args.app) as { id: number; total_sec: number } | undefined;
      if (existingDaily) {
        d.prepare('UPDATE daily_stats SET total_sec = total_sec + ?, sessions = sessions + 1 WHERE id = ?')
          .run(durationSec, existingDaily.id);
      } else {
        d.prepare(
          'INSERT INTO daily_stats (date, app, category, total_sec, sessions) VALUES (?, ?, ?, ?, 1)',
        ).run(date, args.app, args.category, durationSec);
      }

      const existingSession = d
        .prepare('SELECT id FROM sessions WHERE app = ? AND is_active = 1 ORDER BY start_time DESC LIMIT 1')
        .get(args.app) as { id: number } | undefined;
      if (existingSession) {
        d.prepare('UPDATE sessions SET duration_sec = duration_sec + ? WHERE id = ?')
          .run(durationSec, existingSession.id);
      } else {
        d.prepare(
          'INSERT INTO sessions (app, category, start_time, end_time, duration_sec, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        ).run(args.app, args.category, args.timestamp, args.timestamp, durationSec);
      }

      const existingAgg = d
        .prepare('SELECT id, total_sec FROM daily_aggregates WHERE date = ? AND app = ?')
        .get(date, args.app) as { id: number; total_sec: number } | undefined;
      if (existingAgg) {
        d.prepare('UPDATE daily_aggregates SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE id = ?')
          .run(durationSec, existingAgg.id);
      } else {
        d.prepare(
          'INSERT INTO daily_aggregates (date, app, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)',
        ).run(date, args.app, args.category, durationSec);
      }
    }

    if (args.is_browser_tracking && args.domain) {
      const existingBrowser = d
        .prepare('SELECT id FROM browser_sessions WHERE date = ? AND domain = ?')
        .get(date, args.domain) as { id: number } | undefined;
      if (existingBrowser) {
        d.prepare('UPDATE browser_sessions SET total_sec = total_sec + ?, session_count = session_count + 1 WHERE id = ?')
          .run(durationSec, existingBrowser.id);
      } else {
        d.prepare(
          'INSERT INTO browser_sessions (date, domain, category, total_sec, session_count) VALUES (?, ?, ?, ?, 1)',
        ).run(date, args.domain, args.category, durationSec);
      }
    }
  } catch (err) {
    warn('updateAggregates failed:', (err as Error).message);
  }
}

/** Single transaction so a row and its aggregates can never disagree. */
export function commitLog(row: LogRow, aggregates: Parameters<typeof updateAggregates>[0]): boolean {
  const d = openDb();
  if (!d) return false;
  const safeDuration = Math.min(Math.max(0, Math.floor(row.duration_ms)), MAX_LOGGED_SESSION_MS);
  if (safeDuration <= 0) return false;
  d.exec('BEGIN IMMEDIATE');
  try {
    const ok = addLog({ ...row, duration_ms: safeDuration });
    if (!ok) {
      d.exec('ROLLBACK');
      return false;
    }
    updateAggregates({ ...aggregates, duration_ms: safeDuration });
    d.exec('COMMIT');
    return true;
  } catch (err) {
    try {
      d.exec('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    warn('commitLog rolled back:', (err as Error).message);
    return false;
  }
}