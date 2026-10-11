import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/**
 * Bidirectional merge between the Linux profile and the Windows/NtFS profile.
 *
 * WHY THIS IS NOT "COPY ONE DB FILE OVER THE OTHER"
 * -------------------------------------------------
 * `logs.id` is INTEGER PRIMARY KEY AUTOINCREMENT, so it is NOT stable across two
 * databases that both accepted writes. On this machine's real data both sides had
 * rows in the id range 33761-33777 meaning different things. Therefore:
 *   - copying one file over the other  -> destroys the other side's rows
 *   - INSERT OR REPLACE by id          -> silently overwrites
 * A throwaway reproduction confirmed 3 rows vanishing with no error raised.
 *
 * WHY THE MERGE KEY IS A FULL-ROW HASH
 * ------------------------------------
 * `logs` has no natural key. The obvious candidate (timestamp, app, duration_ms)
 * is NOT unique: the real data has 7 groups where it repeats. But all 7 are
 * byte-identical whole rows with adjacent ids — a historic double-write, not two
 * distinct sessions. Hashing every meaningful column means:
 *   - a row present on both sides collapses to one (correct: it IS the same row)
 *   - a row unique to one side is preserved with all of its data (correct)
 *
 * WHY AGGREGATES ARE NEVER MERGED
 * ------------------------------
 * stats_hourly, stats_daily, app_totals and daily_stats are derivable from `logs`.
 * Merging them independently would mean reconciling two independently-drifted
 * running totals. Instead they are rebuilt from `logs` after the merge, which is
 * simpler and provably correct.
 *
 * Usage:
 *   node sync.mjs            merge both ways (default)
 *   node sync.mjs --status   report only, change nothing
 */

const LABEL = '[rheo-sync]';

const HOME = process.env.RHEO_SYNC_HOME || process.env.HOME || '';
const LINUX_DIR = process.env.RHEO_TRACKER_USER_DATA || path.join(HOME, '.config', 'RHEO');
const NTFS_DIR =
  process.env.RHEO_NTFS_PROFILE ||
  '/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO';

// Explicit DB paths override the directory-derived ones. This exists so the merge
// can be exercised against copies in a sandbox without touching either real
// profile — a merge test must never be run against the only good copy.
const LINUX_DB = process.env.RHEO_LINUX_DB || path.join(LINUX_DIR, 'deskflow-data.db');
const NTFS_DB = process.env.RHEO_NTFS_DB || path.join(NTFS_DIR, 'deskflow-data.db');

// The lock lives on the Ntfs partition: it is the one location both operating
// systems can see. A lock under ~/.config would not stop a Windows-side writer.
const LOCK_PATH = path.join(path.dirname(NTFS_DIR), '.rheo-sync.lock');

const STATUS_ONLY = process.argv.includes('--status');

/**
 * Columns that make up a row's identity. `id` is deliberately excluded — it is
 * the thing that collides. `source` and `platform` are excluded because the same
 * usage can legitimately be labelled differently on each side.
 */
const SIG_COLUMNS = [
  'timestamp',
  'app',
  'category',
  'duration_ms',
  'title',
  'project',
  'url',
  'domain',
  'tab_id',
  'is_browser_tracking',
];

const SIG_EXPR = SIG_COLUMNS.map((c) => `COALESCE(CAST("${c}" AS TEXT),'')`).join(` || '␟' || `);

function log(...a) {
  try {
    console.log(LABEL, ...a);
  } catch {
    /* stdout closed */
  }
}

function hashOf(sig) {
  return createHash('sha1').update(sig).digest('hex');
}

// ── Cross-OS lock ────────────────────────────────────────────────────────────
function acquireLock() {
  const claim = () => {
    try {
      fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
      return true;
    } catch {
      return false;
    }
  };
  if (claim()) return true;
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        log(`another sync holds the lock (pid ${pid}) — refusing to run`);
        return false;
      } catch (e) {
        if ((e).code === 'EPERM') {
          log(`another sync holds the lock (pid ${pid}) — refusing to run`);
          return false;
        }
      }
    }
    log('clearing a stale lock');
    fs.unlinkSync(LOCK_PATH);
    return claim();
  } catch (err) {
    log('could not take the lock:', (err).message);
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.readFileSync(LOCK_PATH, 'utf8').trim() === String(process.pid)) fs.unlinkSync(LOCK_PATH);
  } catch {
    /* ignore */
  }
}

/**
 * Refuse to merge while either side may be writing. Reading a moving target drops
 * rows inserted mid-scan; on Windows the file is locked anyway. A missed sync is
 * recoverable, a corrupted one is not.
 */
function assertNoWriter() {
  const blockers = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    let raw;
    try {
      raw = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      continue;
    }
    if (!raw) continue;
    const a = raw.split('\0').filter(Boolean);
    if (a.some((x) => x.startsWith('--type='))) continue;
    const base = (a[0] || '').split('/').pop() || '';
    if (base === 'electron' || base === 'electron.exe') blockers.push(`electron pid ${entry}`);
  }
  // Anything on the browser-ingest port is a live tracker or app.
  try {
    const out = execFileSync('ss', ['-ltn'], { encoding: 'utf8' });
    if (/127\.0\.0\.1:54321\s/.test(out)) blockers.push('port 54321 listening');
  } catch {
    /* ss unavailable */
  }
  if (blockers.length) {
    throw new Error(`refusing to merge, a writer may be active: ${blockers.join(', ')}`);
  }
}

const openRo = (p) => new DatabaseSync(p, { readOnly: true });

/** Map of content-hash -> how many rows share it, for one side. */
function hashCounts(db) {
  const rows = db.prepare(`SELECT ${SIG_EXPR} AS sig FROM logs`).all();
  const m = new Map();
  for (const r of rows) {
    const h = hashOf(r.sig);
    m.set(h, (m.get(h) ?? 0) + 1);
  }
  return m;
}

function count(db, sql) {
  return db.prepare(sql).get().n;
}

const hasTable = (db, t) =>
  !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);

/**
 * Insert rows present in `from` but absent from `to`, then rebuild the derived
 * aggregates from `logs`.
 *
 * Duplicate handling: where a hash appears k times in `from` and j times in `to`,
 * only max(0, k-j) copies are inserted. For a genuine pair of identical rows this
 * collapses the duplicate (desirable); for the common case k=1 it is a plain
 * set-union.
 */
function mergeInto(to, from) {
  const src = openRo(from.dbPath);
  const dst = new DatabaseSync(to.dbPath);
  dst.exec('PRAGMA busy_timeout = 15000');

  const srcRows = src
    .prepare(`SELECT ${SIG_EXPR} AS sig, ${SIG_COLUMNS.join(', ')} FROM logs ORDER BY id`)
    .all();

  const srcCounts = hashCounts(src);
  const dstCounts = hashCounts(dst);

  // How many copies of each hash we still need in `to`.
  const need = new Map();
  for (const [h, k] of srcCounts) {
    const deficit = k - (dstCounts.get(h) ?? 0);
    if (deficit > 0) need.set(h, deficit);
  }
  if (need.size === 0) {
    src.close();
    dst.close();
    return 0;
  }

  dst.exec('BEGIN IMMEDIATE');
  let inserted = 0;
  try {
    const stmt = dst.prepare(
      `INSERT INTO logs (${SIG_COLUMNS.join(', ')}) VALUES (${SIG_COLUMNS.map(() => '?').join(', ')})`,
    );
    for (const row of srcRows) {
      const h = hashOf(row.sig);
      const remaining = need.get(h);
      if (!remaining) continue;
      stmt.run(...SIG_COLUMNS.map((c) => (row[c] === null ? null : row[c])));
      need.set(h, remaining - 1);
      inserted++;
    }
    rebuildAggregates(dst);
    dst.exec('COMMIT');
  } catch (err) {
    dst.exec('ROLLBACK');
    src.close();
    dst.close();
    throw err;
  }
  src.close();
  dst.close();
  return inserted;
}

/**
 * Rebuild derived tables from `logs`, which is the single source of truth.
 *
 * stats_hourly / stats_daily / app_totals are recomputed wholesale with the same
 * GROUP BY the AFTER INSERT triggers use, so the result matches what a fresh
 * series of inserts would have produced. daily_stats keeps its non-derivable
 * columns (focus_score, keystrokes, clicks) and only has its totals recomputed.
 */
function rebuildAggregates(dst) {
  if (hasTable(dst, 'stats_hourly')) {
    dst.exec('DELETE FROM stats_hourly');
    dst.exec(`
      INSERT INTO stats_hourly (date, hour, app_name, app_type, category, total_seconds, session_count, platform)
      SELECT DATE(timestamp), CAST(STRFTIME('%H', timestamp) AS INTEGER),
             COALESCE(domain, app),
             CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END,
             category, SUM(CAST(duration_ms AS REAL) / 1000.0), COUNT(*), 'linux'
      FROM logs WHERE duration_ms > 0
      GROUP BY DATE(timestamp), CAST(STRFTIME('%H', timestamp) AS INTEGER), COALESCE(domain, app)
    `);
  }
  if (hasTable(dst, 'stats_daily')) {
    dst.exec('DELETE FROM stats_daily');
    dst.exec(`
      INSERT INTO stats_daily (date, app_name, app_type, category, total_seconds, session_count, platform)
      SELECT DATE(timestamp), COALESCE(domain, app),
             CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END,
             category, SUM(CAST(duration_ms AS REAL) / 1000.0), COUNT(*), 'linux'
      FROM logs WHERE duration_ms > 0
      GROUP BY DATE(timestamp), COALESCE(domain, app)
    `);
  }
  if (hasTable(dst, 'app_totals')) {
    dst.exec('DELETE FROM app_totals');
    dst.exec(`
      INSERT INTO app_totals (app_name, app_type, category, total_seconds, session_count, last_seen)
      SELECT COALESCE(domain, app),
             CASE WHEN domain IS NOT NULL THEN 'domain' ELSE 'app' END,
             category, SUM(CAST(duration_ms AS REAL) / 1000.0), COUNT(*), MAX(timestamp)
      FROM logs WHERE duration_ms > 0
      GROUP BY COALESCE(domain, app)
    `);
  }
  if (hasTable(dst, 'daily_stats')) {
    // Only the derivable columns are touched; focus/keystroke columns are preserved.
    dst.exec(`
      UPDATE daily_stats SET
        total_sec = COALESCE((SELECT SUM(CAST(l.duration_ms AS INTEGER) / 1000)
                              FROM logs l
                              WHERE l.is_browser_tracking = 0
                                AND substr(l.timestamp, 1, 10) = daily_stats.date
                                AND l.app = daily_stats.app), 0),
        sessions  = COALESCE((SELECT COUNT(*) FROM logs l
                              WHERE l.is_browser_tracking = 0
                                AND substr(l.timestamp, 1, 10) = daily_stats.date
                                AND l.app = daily_stats.app), 0),
        avg_session_sec = COALESCE((SELECT AVG(CAST(l.duration_ms AS REAL) / 1000)
                              FROM logs l
                              WHERE l.is_browser_tracking = 0
                                AND substr(l.timestamp, 1, 10) = daily_stats.date
                                AND l.app = daily_stats.app), 0)
    `);
  }
  if (hasTable(dst, 'browser_sessions')) {
    dst.exec(`
      UPDATE browser_sessions SET
        total_sec = COALESCE((SELECT SUM(CAST(l.duration_ms AS INTEGER) / 1000)
                              FROM logs l
                              WHERE substr(l.timestamp, 1, 10) = browser_sessions.date
                                AND l.domain = browser_sessions.domain), 0),
        session_count = COALESCE((SELECT COUNT(*) FROM logs l
                              WHERE substr(l.timestamp, 1, 10) = browser_sessions.date
                                AND l.domain = browser_sessions.domain), 0)
    `);
  }
}

function main() {
  const linux = { name: 'linux', dbPath: LINUX_DB };
  const ntfs = { name: 'ntfs', dbPath: NTFS_DB };

  for (const s of [linux, ntfs]) {
    if (!fs.existsSync(s.dbPath)) log(`${s.name}: MISSING (${s.dbPath})`);
  }
  if (!fs.existsSync(linux.dbPath) || !fs.existsSync(ntfs.dbPath)) {
    log('both profiles must exist to merge — nothing changed.');
    return;
  }

  const dl = openRo(linux.dbPath);
  const dn = openRo(ntfs.dbPath);
  const hl = hashCounts(dl);
  const hn = hashCounts(dn);

  let onlyLinux = 0;
  for (const [h, k] of hl) onlyLinux += Math.max(0, k - (hn.get(h) ?? 0));
  let onlyNtfs = 0;
  for (const [h, k] of hn) onlyNtfs += Math.max(0, k - (hl.get(h) ?? 0));

  const newestOf = (db) => db.prepare('SELECT max(timestamp) t FROM logs').get().t;
  log(`linux: ${count(dl, 'SELECT count(*) n FROM logs')} logs, newest ${newestOf(dl)}`);
  log(`ntfs : ${count(dn, 'SELECT count(*) n FROM logs')} logs, newest ${newestOf(dn)}`);
  log(`rows only in linux: ${onlyLinux}`);
  log(`rows only in ntfs : ${onlyNtfs}`);

  if (STATUS_ONLY) {
    log('--status: nothing was changed');
    dl.close();
    dn.close();
    return;
  }
  dl.close();
  dn.close();

  if (onlyLinux === 0 && onlyNtfs === 0) {
    log('profiles already equivalent — nothing to do');
    return;
  }

  if (!process.env.RHEO_SYNC_SKIP_WRITER_GATE) assertNoWriter();

  // Windows first, so if we are interrupted the Linux side (the live one) is the
  // guaranteed-complete copy rather than the partially-merged one.
  const intoNtfs = mergeInto(ntfs, linux);
  log(`  -> ntfs : inserted ${intoNtfs}`);
  const intoLinux = mergeInto(linux, ntfs);
  log(`  -> linux: inserted ${intoLinux}`);
  log('merge complete');
}

log(`${STATUS_ONLY ? 'status' : 'merge'} — linux=${LINUX_DIR} ntfs=${NTFS_DIR}`);
if (!acquireLock()) process.exit(2);
try {
  main();
} catch (err) {
  log('ERROR:', (err).message);
  process.exitCode = 1;
} finally {
  releaseLock();
}
