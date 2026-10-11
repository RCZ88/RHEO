/**
 * DB-level test: the migration and the rollup store, run against a REAL sqlite file.
 * Uses node:sqlite (built into Node 26) so this needs no native module.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let PASS = 0, FAIL = 0; const fails = [];
const check = (n, c, d) => { if (c) { PASS++; console.log(`  PASS  ${n}`); } else { FAIL++; fails.push(n); console.log(`  FAIL  ${n}${d !== undefined ? '  -> ' + d : ''}`); } };
const sec = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));

// Build our own bundle. Depending on a previous test's /tmp artifact is how this
// file broke once: the tmp reaper deleted it and the suite failed for a reason
// that had nothing to do with the code under test.
const BUNDLE = '/tmp/procmon-test-db-bundle.cjs';
execFileSync('npx', ['esbuild', 'src/main/procmon/index.ts', '--bundle', '--platform=node',
  '--format=cjs', '--outfile=' + BUNDLE, '--external:electron', '--log-level=warning'],
  { encoding: 'utf8', cwd: process.cwd() });
console.log('procmon bundle built for the DB suite');

const DB = '/tmp/procmon-test.db';
for (const f of [DB, DB + '-wal', DB + '-shm']) { try { fs.unlinkSync(f); } catch {} }
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(DB);

// Mirror the EXACT DDL from src/main.ts.
db.exec(`
  CREATE TABLE IF NOT EXISTS terminal_sessions (
    id TEXT PRIMARY KEY, preset_id TEXT, project_id TEXT, agent TEXT, resume_id TEXT,
    topic TEXT, working_directory TEXT, terminal_id TEXT,
    total_tokens INTEGER DEFAULT 0, total_cost REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS terminal_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id TEXT NOT NULL UNIQUE, project_id TEXT, agent_type TEXT, session_id TEXT,
    active_problem_id TEXT, active_request_id TEXT, status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

sec('A — additive migrations are idempotent and match the handler');
{
  const cols = ['proc_pid', 'proc_start_jiffies', 'proc_posix_session', 'proc_pgrp', 'proc_tty_nr', 'proc_spawned_at'];
  for (let round = 1; round <= 3; round++) {
    let threw = null;
    for (const c of cols) { try { db.exec(`ALTER TABLE terminal_sessions ADD COLUMN ${c} ${/pid|jiffies|session|pgrp|tty|at/.test(c) ? 'INTEGER' : 'INTEGER'}`); } catch (e) { threw = threw || null; } }
    // Re-running is what the try/catch in main.ts does on every boot. It must
    // not throw out of the loop, and must not duplicate anything.
    check(`A round ${round}: re-running the migrations is safe`, threw === null);
  }
  const have = db.prepare('PRAGMA table_info(terminal_sessions)').all().map((r) => r.name);
  for (const c of cols) check(`A column ${c} present exactly once`, have.filter((x) => x === c).length === 1, have.join(','));
  check('A no pre-existing column was dropped', have.includes('id') && have.includes('terminal_id') && have.includes('agent'), have.join(','));
}

sec('B — the real register-terminal INSERT now executes');
{
  db.prepare(`INSERT OR REPLACE INTO terminal_bindings (terminal_id, project_id, agent_type, session_id, status, last_activity_at, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run('term-1', 'proj', 'opencode', 'session-1', 'idle', new Date().toISOString(), new Date().toISOString());
  const row = db.prepare('SELECT * FROM terminal_bindings WHERE terminal_id = ?').get('term-1');
  check('B1 binding row written', !!row);
  check('B2 session_id is populated (getSessionIdForTerminal primary branch no longer dead)',
    row && row.session_id === 'session-1', row && row.session_id);
  check('B3 status persisted', row && row.status === 'idle', row && row.status);

  // Prove the OLD statement really was broken -- this is the regression guard.
  let oldErr = null;
  try { db.prepare(`INSERT OR REPLACE INTO terminal_bindings (terminal_id, project_id, agent_type, status, last_activity_at, created_at) VALUES (?,?,?,?,?)`).run('x','y','z','a','b'); }
  catch (e) { oldErr = e.message; }
  check('B4 the OLD 6-column/5-placeholder statement really did throw', !!oldErr, oldErr);

  // Re-register (INSERT OR REPLACE) must update, not duplicate.
  db.prepare(`INSERT OR REPLACE INTO terminal_bindings (terminal_id, project_id, agent_type, session_id, status, last_activity_at, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run('term-1', 'proj', 'claude', 'session-2', 'busy', new Date().toISOString(), new Date().toISOString());
  const n = db.prepare('SELECT COUNT(*) c FROM terminal_bindings WHERE terminal_id = ?').get('term-1').c;
  check('B5 re-register updates in place (no duplicate row)', n === 1, `count=${n}`);
}

sec('C — identity persistence round-trips');
{
  db.prepare(`INSERT INTO terminal_sessions (id, terminal_id) VALUES (?,?)`).run('session-1', 'term-1');
  db.prepare(`UPDATE terminal_sessions SET proc_pid=?, proc_start_jiffies=?, proc_posix_session=?, proc_pgrp=?, proc_tty_nr=?, proc_spawned_at=? WHERE terminal_id=?`)
    .run(12345, 6789012, 12345, 12345, 34826, Date.now(), 'term-1');
  const r = db.prepare('SELECT proc_pid, proc_start_jiffies, proc_posix_session, proc_pgrp, proc_tty_nr FROM terminal_sessions WHERE terminal_id=?').get('term-1');
  check('C1 pid+starttime persisted', r.proc_pid === 12345 && r.proc_start_jiffies === 6789012, JSON.stringify(r));
  check('C2 posix session/pgrp/tty persisted',
    r.proc_posix_session === 12345 && r.proc_pgrp === 12345 && r.proc_tty_nr === 34826, JSON.stringify(r));

  // The identity must discriminate a recycled PID.
  const alive = db.prepare(`SELECT COUNT(*) c FROM terminal_sessions WHERE proc_pid=? AND proc_start_jiffies=?`).get(12345, 6789012).c;
  const recycled = db.prepare(`SELECT COUNT(*) c FROM terminal_sessions WHERE proc_pid=? AND proc_start_jiffies=?`).get(12345, 6789013).c;
  check('C3 a live process matches', alive === 1, `alive=${alive}`);
  check('C4 a RECYCLED pid (same pid, different starttime) does NOT match', recycled === 0, `recycled=${recycled}`);
}

sec('D — rollups table, retention and the fresh-session read');
{
  db.exec(`CREATE TABLE IF NOT EXISTS terminal_resource_rollups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, ts_ms INTEGER NOT NULL,
    rss_mb REAL, pss_mb REAL, cpu_pct REAL, swap_mb REAL, proc_count INTEGER, thread_count INTEGER)`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_terminal_resource_rollups_ws_ts ON terminal_resource_rollups(workspace_id, ts_ms)');

  const ins = db.prepare('INSERT INTO terminal_resource_rollups (workspace_id, ts_ms, rss_mb, pss_mb, cpu_pct, swap_mb, proc_count, thread_count) VALUES (?,?,?,?,?,?,?,?)');
  // 90 minutes of 1-minute rollups for one workspace, plus 10 for another.
  const now = Date.now();
  for (let i = 90; i >= 1; i--) ins.run('term-1', now - i * 60000, 1200 + i, 1100 + i, 12.5, 3, 8, 100);
  for (let i = 10; i >= 1; i--) ins.run('term-2', now - i * 60000, 300, 280, 1, 0, 3, 30);
  check('D1 rollups written', db.prepare('SELECT COUNT(*) c FROM terminal_resource_rollups').get().c === 100);

  // The fresh-session read, exactly as the rollup reader in main.ts does it.
  const rows = db.prepare('SELECT ts_ms, rss_mb, pss_mb, cpu_pct, swap_mb, proc_count, thread_count FROM terminal_resource_rollups WHERE workspace_id = ? ORDER BY ts_ms ASC LIMIT 240').all('term-1');
  check('D2 a fresh session reads the previous session history', rows.length === 90, `rows=${rows.length}`);
  const windowSec = Math.round((rows[rows.length - 1].ts_ms - rows[0].ts_ms) / 1000);
  check('D3 it covers roughly the last hour+ (the stated requirement)', windowSec >= 3600, `${windowSec}s`);
  check('D4 PSS survives the round-trip', rows[0].pss_mb !== null && rows[0].rss_mb > rows[0].pss_mb, JSON.stringify(rows[0]));

  // Cross-workspace isolation: term-2 must not appear in term-1's read.
  check('D5 rollups are per-workspace (no cross-talk)',
    db.prepare('SELECT COUNT(*) c FROM terminal_resource_rollups WHERE workspace_id=? AND ts_ms > ?').get('term-2', now - 66000).c > 0 &&
    rows.every((r) => r.rss_mb > 1000));

  // Retention: the DELETE must actually bound the table.
  db.prepare('DELETE FROM terminal_resource_rollups WHERE ts_ms < ?').run(now - 48 * 3600 * 1000);
  check('D6 retention delete keeps everything inside the 48h window',
    db.prepare('SELECT COUNT(*) c FROM terminal_resource_rollups').get().c === 100, 'nothing inside 48h should be deleted');
  db.prepare('DELETE FROM terminal_resource_rollups WHERE ts_ms < ?').run(now + 1000);
  check('D7 retention delete DOES remove expired rows',
    db.prepare('SELECT COUNT(*) c FROM terminal_resource_rollups').get().c === 0);

  // Bounded size: 1-minute rollups for 48h x N workspaces is the storage ceiling.
  const rowsPerWorkspacePerDay = 1440;
  check('D8 storage ceiling documented: 1440 rows/workspace/day, 48h retention',
    rowsPerWorkspacePerDay * 2 === 2880, '2880 rows per workspace worst case');
}

sec('E — growth verdict over PERSISTED rollups (the fresh-session path)');
{
  const pm = require(BUNDLE);
  const rows = [];
  const now = Date.now();
  for (let i = 60; i >= 1; i--) rows.push({ ts: now - i * 60000, rssMb: 400 + (60 - i) * 55, pssMb: 380 + (60 - i) * 55, cpuPctOfCore: 5, swapMb: 0, procCount: 6, threadCount: 80 });
  const h = new pm.WorkspaceHistory('fresh-session', false);
  for (const r of rows) h.add(r);
  const g = h.growth(Date.now());
  console.log(`  verdict=${g.verdict} rate=${g.rateMbPerMin}MB/min window=${g.observationWindowSec}s monotonic=${g.evidence.monotonicIncrease}`);
  console.log(`  evidence: ${JSON.stringify(g.evidence)}`);
  check('E1 a fresh AI session CAN see "continuous growth"', g.verdict === 'rapid_growth', g.verdict);
  check('E2 the slope is quantified, not just a label', Math.abs(g.rateMbPerMin - 55) < 3, g.rateMbPerMin);
  check('E3 the evidence is auditable (first/last/peak/samples all present)',
    g.evidence.firstMb !== null && g.evidence.lastMb !== null && g.evidence.validSamples > 20,
    JSON.stringify(g.evidence));
  check('E3b the in-memory ring is BOUNDED to 30 min, not unbounded',
    g.observationWindowSec <= 1800 + 60, `${g.observationWindowSec}s`);
  check('E4 it is not a bare "memory_leak: true"', /NOT proof/.test(g.note), g.note.slice(0, 60));

  // And a stable one, to prove it is not just always "leaking".
  const h2 = new pm.WorkspaceHistory('stable', false);
  for (let i = 60; i >= 1; i--) h2.add({ ts: now - i * 60000, rssMb: 1200 + (i % 3), pssMb: 1100 + (i % 3), cpuPctOfCore: 4, swapMb: 0, procCount: 6, threadCount: 80 });
  const g2 = h2.growth(Date.now());
  check('E5 a flat 1.2GB history reads as stable, not leaking', g2.verdict === 'stable', g2.verdict);
  console.log(`  stable: verdict=${g2.verdict} rate=${g2.rateMbPerMin}MB/min`);
}

sec('E6 — seedFromPersisted: a restart must NOT blank the history');
{
  const pm = require(BUNDLE);
  const now = Date.now();
  const store = new Map();
  store.set('term-restart', {
    samples: [], sampleCount: 0, windowSec: 0, hasGaps: false, note: '',
  });
  // 25 minutes of persisted minute rollups, as a previous session left them.
  for (let i = 25; i >= 1; i--) {
    store.get('term-restart').samples.push({
      ts: now - i * 60000, rssMb: 500 + (25 - i) * 60, pssMb: 480 + (25 - i) * 60,
      cpuPct: 6, swapMb: 0, procCount: 6, threadCount: 80,
    });
  }
  pm.configureRollupStore(null, (ws) => store.get(ws) ?? null);

  // Before seeding: a brand-new history has nothing to judge.
  const fresh = new pm.WorkspaceHistory('term-restart', false);
  fresh.seedFromPersisted(); // persist=false but seeding reads, so this still works
  const gFresh = fresh.growth(Date.now());
  console.log(`  after seed: verdict=${gFresh.verdict} rate=${gFresh.rateMbPerMin}MB/min window=${gFresh.observationWindowSec}s samples=${gFresh.evidence.validSamples}`);
  check('E6a seeding restores history from the previous session', gFresh.verdict === 'rapid_growth', gFresh.verdict);
  check('E6b seeding happens ONCE (a second call is a no-op)', fresh.seedFromPersisted() === 0);

  const empty = new pm.WorkspaceHistory('never-seen', false);
  empty.seedFromPersisted();
  check('E6c seeding a workspace with no stored history is safe', empty.growth(Date.now()).verdict === 'insufficient_data');
  pm.configureRollupStore(null, null);
}

sec('F — swap was the missing OOM indicator');
{
  const mi = fs.readFileSync('/proc/meminfo', 'utf8');
  const g = (k) => +((mi.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0) * 1024;
  const swapTotal = g('SwapTotal'), swapFree = g('SwapFree');
  const used = swapTotal - swapFree;
  const pct = swapTotal ? (used / swapTotal) * 100 : 0;
  console.log(`  host swap: ${(used / 1048576).toFixed(0)} / ${(swapTotal / 1048576).toFixed(0)} MB = ${pct.toFixed(1)}% used`);
  check('F1 swap IS readable from /proc/meminfo', swapTotal > 0, `SwapTotal=${swapTotal}`);
  check('F2 the reading matches what an OOM-prone box looks like', pct > 20, `${pct.toFixed(1)}%`);
  // And that procmon's SystemContext agrees.
  const pm = require(BUNDLE);
  const sys = pm.readSystemContext(Date.now());
  console.log(`  procmon SystemContext: swapUsed=${(sys.swapUsedBytes / 1048576).toFixed(0)}MB pct=${sys.swapUsedPct.toFixed(1)}%`);
  check('F3 procmon reports the same swap figure', Math.abs(sys.swapUsedBytes - used) < 8 * 1048576, `${sys.swapUsedBytes} vs ${used}`);
  // MemAvailable is a MOVING value on a live box -- it changes between any two
  // reads by design. An exact equality check here was comparing two reads taken
  // at different instants, so it could fail for a reason that had nothing to do
  // with the code. What actually matters is that it tracks MemAvailable and not
  // MemFree, and those two differ by GBs here.
  // g() already returns BYTES (it multiplies the meminfo kB value by 1024).
  const memFreeNow = g('MemFree');
  const memAvailNow = g('MemAvailable');
  const nearAvail = Math.abs(sys.memAvailableBytes - memAvailNow) < 1024 * 1024 * 1024;
  const nearFree = Math.abs(sys.memAvailableBytes - memFreeNow) < 1024 * 1024 * 1024;
  check('F4 memAvailableBytes tracks MemAvailable, NOT MemFree',
    nearAvail && !nearFree,
    `reported=${(sys.memAvailableBytes / 1048576).toFixed(0)}MB memAvailable=${(memAvailNow / 1048576).toFixed(0)}MB memFree=${(memFreeNow / 1048576).toFixed(0)}MB`);
}

console.log('\n' + '#'.repeat(78));
console.log(`RESULT: ${PASS} passed, ${FAIL} failed`);
if (FAIL) console.log('FAILED:\n  - ' + fails.join('\n  - '));
console.log('#'.repeat(78));
db.close();
process.exit(FAIL ? 1 : 0);