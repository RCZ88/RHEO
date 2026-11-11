import { DatabaseSync } from 'node:sqlite';
import {
  DB_PATH,
  MAX_LOGGED_SESSION_MS,
  BROWSER_SESSION_MERGE_WINDOW_MS,
  log,
  warn,
} from './config';

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
  /** Which browser sent the payload (e.g. 'firefox', 'chrome'). The schema has
   *  these columns; the daemon used to DROP them, which is why 100% of
   *  daemon-written browser rows had NULL attribution and per-browser reports
   *  could never work while the daemon owned tracking. */
  browser_name?: string | null;
  profile_id?: string | null;
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
          tab_id, is_browser_tracking, platform, source, profile_id, browser_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      row.profile_id ?? null,
      row.browser_name ?? null,
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

// ── Browser session registry ────────────────────────────────────────────────
//
// The 2026-11-10/11 data-loss incident: the daemon INSERTed one row per payload,
// and a tab-switch snapshot (is_periodic:false, delta_ms:0) resolved through
// `delta_ms || active_duration_ms` to the session's CUMULATIVE total. The
// extension re-delivers snapshots (MV3 service-worker restarts, focus changes,
// the retry queue), so one 3-hour YouTube session became 252 rows at ONE
// timestamp, each capped at 1 h — days that totalled 600.2 h in a 24-h world.
//
// The fix is the app's own proven model (src/main.ts:24366-24448), with the
// DATABASE as the session registry because daemon memory does not survive a
// restart:
//   periodic   → ADD the delta to the session row (nearest match in-window),
//                bounded by the 1 h row ceiling;
//   snapshot   → RAISE the session row to max(existing, total). Never adds.
//   replay     → an exact (timestamp, domain, browser, profile) twin for a
//                periodic payload is a re-delivered tick: skipped, not added.
// A snapshot is naturally idempotent (max cannot double-count).

export interface BrowserPayloadWrite {
  /** Session START for a snapshot, SYNC time for a periodic delta — the
   *  extension defines the identity, and the row's timestamp IS that value. */
  timestamp: string;
  app: string;
  category: string;
  /** delta (periodic) or session total (snapshot), bounded by the caller. */
  magnitudeMs: number;
  isPeriodic: boolean;
  title?: string | null;
  url?: string | null;
  domain?: string | null;
  tab_id?: number | null;
  browser_name?: string | null;
  profile_id?: string | null;
}

export function commitBrowserPayload(
  p: BrowserPayloadWrite,
): { ok: boolean; addedMs: number; replay: boolean; reason?: string } {
  const d = openDb();
  if (!d) return { ok: false, addedMs: 0, replay: false, reason: 'no DB' };
  const magnitude = Math.min(Math.max(0, Math.floor(p.magnitudeMs)), MAX_LOGGED_SESSION_MS);
  if (magnitude <= 0) return { ok: false, addedMs: 0, replay: false, reason: 'no duration' };
  const domain = p.domain || null;
  if (!domain) return { ok: false, addedMs: 0, replay: false, reason: 'no domain' };

  d.exec('BEGIN IMMEDIATE');
  try {
    // 1. Exact replay check (periodic only). A periodic payload's timestamp is
    //    its SYNC time, unique per tick — the same timestamp + domain + profile
    //    again means the payload was delivered twice (retry queue, SW restart).
    //    This is what makes retrying deltas safe instead of additive.
    if (p.isPeriodic) {
      const replay = d
        .prepare(
          `SELECT id FROM logs
             WHERE is_browser_tracking = 1
               AND domain = ?
               AND timestamp = ?
               AND (browser_name IS ? OR browser_name IS NULL)
               AND (profile_id IS ? OR profile_id IS NULL)
             LIMIT 1`,
        )
        .get(domain, p.timestamp, p.browser_name ?? null, p.profile_id ?? null) as
        | { id: number }
        | undefined;
      if (replay) {
        d.exec('ROLLBACK');
        return { ok: true, addedMs: 0, replay: true };
      }
    }

    // 2. Find the session row this payload belongs to. A snapshot names its
    //    session explicitly (timestamp IS the session start), but the row it
    //    belongs to may carry the FIRST TICK's timestamp instead: the first
    //    periodic sync fires up to 30 s AFTER activation, so an exact match
    //    misses by that skew — and the miss was a second INSERT carrying the
    //    whole cumulative session again (a 2x overcount per session). So both
    //    shapes fall back to the NEAREST row for the same domain inside the
    //    merge window; snapshots still only RAISE, so the fallback cannot
    //    double-count, it can only fold a revisit into the previous row — the
    //    same semantics the app's in-memory session map has.
    let twin:
      | { id: number; timestamp: string; duration_ms: number }
      | undefined;
    if (p.isPeriodic) {
      twin = d
        .prepare(
          `SELECT id, timestamp, duration_ms FROM logs
             WHERE is_browser_tracking = 1
               AND domain = ?
               AND (browser_name IS ? OR browser_name IS NULL)
               AND (profile_id IS ? OR profile_id IS NULL)
               AND ABS(julianday(timestamp) - julianday(?)) * 86400000 <= ?
             ORDER BY ABS(julianday(timestamp) - julianday(?)) ASC
             LIMIT 1`,
        )
        .get(
          domain,
          p.browser_name ?? null,
          p.profile_id ?? null,
          p.timestamp,
          BROWSER_SESSION_MERGE_WINDOW_MS,
          p.timestamp,
        ) as { id: number; timestamp: string; duration_ms: number } | undefined;
    } else {
      twin = d
        .prepare(
          `SELECT id, timestamp, duration_ms FROM logs
             WHERE is_browser_tracking = 1
               AND domain = ?
               AND timestamp = ?
               AND (browser_name IS ? OR browser_name IS NULL)
               AND (profile_id IS ? OR profile_id IS NULL)
             ORDER BY id DESC
             LIMIT 1`,
        )
        .get(domain, p.timestamp, p.browser_name ?? null, p.profile_id ?? null) as
        | { id: number; timestamp: string; duration_ms: number }
        | undefined;
      if (!twin) {
        // Nearest-row fallback for the activation→first-tick skew, above.
        twin = d
          .prepare(
            `SELECT id, timestamp, duration_ms FROM logs
               WHERE is_browser_tracking = 1
                 AND domain = ?
                 AND (browser_name IS ? OR browser_name IS NULL)
                 AND (profile_id IS ? OR profile_id IS NULL)
                 AND ABS(julianday(timestamp) - julianday(?)) * 86400000 <= ?
               ORDER BY ABS(julianday(timestamp) - julianday(?)) ASC
               LIMIT 1`,
          )
          .get(
            domain,
            p.browser_name ?? null,
            p.profile_id ?? null,
            p.timestamp,
            BROWSER_SESSION_MERGE_WINDOW_MS,
            p.timestamp,
          ) as
          | { id: number; timestamp: string; duration_ms: number }
          | undefined;
      }
    }

    let added = 0;
    if (twin) {
      // 3a. Adopt: periodic ADDS its delta, snapshot RAISES to its total —
      //     and a snapshot may never LOWER the row either (max).
      const raised = p.isPeriodic
        ? Math.min(twin.duration_ms + magnitude, MAX_LOGGED_SESSION_MS)
        : Math.max(twin.duration_ms, magnitude);
      added = raised - twin.duration_ms;
      d.prepare(
        `UPDATE logs SET duration_ms = ?, title = ?, url = ?, category = ?,
             browser_name = COALESCE(?, browser_name),
             profile_id = COALESCE(?, profile_id)
           WHERE id = ?`,
      ).run(
        raised,
        p.title ?? domain,
        p.url ?? domain,
        p.category,
        p.browser_name ?? null,
        p.profile_id ?? null,
        twin.id,
      );
      // Keep the row's original timestamp: it is the session START, and hourly
      // attribution depends on it staying put.
      d.exec('COMMIT');
      if (added > 0) {
        updateAggregates({
          timestamp: twin.timestamp,
          app: p.app,
          category: p.category,
          duration_ms: added,
          domain,
          is_browser_tracking: 1,
        });
        touchBrowserProfileRow(p.profile_id ?? null, p.browser_name ?? null, added);
      }
      return { ok: true, addedMs: added, replay: false };
    }

    // 3b. First payload for this session — insert the row.
    const ok = addLog({
      timestamp: p.timestamp,
      app: p.app,
      category: p.category,
      duration_ms: magnitude,
      title: p.title ?? domain,
      url: p.url ?? null,
      domain,
      tab_id: p.tab_id ?? null,
      is_browser_tracking: 1,
      platform: process.platform,
      source: 'auto',
      browser_name: p.browser_name ?? null,
      profile_id: p.profile_id ?? null,
    });
    if (!ok) {
      d.exec('ROLLBACK');
      return { ok: false, addedMs: 0, replay: false, reason: 'insert failed' };
    }
    d.exec('COMMIT');
    updateAggregates({
      timestamp: p.timestamp,
      app: p.app,
      category: p.category,
      duration_ms: magnitude,
      domain,
      is_browser_tracking: 1,
    });
    touchBrowserProfileRow(p.profile_id ?? null, p.browser_name ?? null, magnitude);
    return { ok: true, addedMs: magnitude, replay: false };
  } catch (err) {
    try {
      d.exec('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    warn('commitBrowserPayload rolled back:', (err as Error).message);
    return { ok: false, addedMs: 0, replay: false, reason: (err as Error).message };
  }
}

/**
 * Mirrors touchBrowserProfile() from src/main.ts:6155 so the profile cards
 * (connection dot, total tracked time) stay truthful while the DAEMON owns
 * tracking — the app cannot do it, it is not running.
 */
export function touchBrowserProfileRow(
  profileId: string | null,
  browserName: string | null,
  addedMs: number,
): void {
  const d = openDb();
  if (!d || !profileId) return;
  const added = Math.max(0, Math.floor(addedMs || 0));
  try {
    const existing = d
      .prepare('SELECT id FROM browser_profiles WHERE profile_id = ?')
      .get(profileId) as { id: number } | undefined;
    if (existing) {
      d.prepare(
        `UPDATE browser_profiles
            SET last_seen_at = datetime('now','localtime'),
                is_connected = 1,
                total_duration_ms = COALESCE(total_duration_ms, 0) + ?,
                updated_at = datetime('now','localtime')
          WHERE id = ?`,
      ).run(added, existing.id);
      return;
    }
    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    d.prepare(
      `INSERT INTO browser_profiles
         (browser_name, profile_id, profile_name, browser_version, last_seen_at, is_connected, color_tag, total_duration_ms)
         VALUES (?, ?, ?, NULL, datetime('now','localtime'), 1, ?, ?)`,
    ).run(browserName || 'browser', profileId, `${browserName || 'Browser'} profile`, color, added);
  } catch (err) {
    warn('touchBrowserProfileRow failed:', (err as Error).message);
  }
}

/**
 * Mirrors isProfileTrackingAllowed() from src/main.ts:6126: a profile the user
 * paused in the app's settings must contribute NOTHING, no matter which process
 * owns tracking. Absent row = never configured = allowed. The name check only
 * applies when we have no profileId at all.
 */
export function isProfileTrackingAllowed(profileId: string | null, browserName: string | null): boolean {
  const d = openDb();
  if (!d) return true;
  try {
    if (profileId) {
      const row = d
        .prepare('SELECT is_active FROM browser_profiles WHERE profile_id = ?')
        .get(profileId) as { is_active: number | null } | undefined;
      return row ? row.is_active !== 0 : true;
    }
    if (browserName) {
      const paused = d
        .prepare('SELECT 1 AS p FROM browser_profiles WHERE browser_name = ? AND is_active = 0 LIMIT 1')
        .get(browserName) as { p: number } | undefined;
      return !paused;
    }
    return true;
  } catch {
    return true;
  }
}