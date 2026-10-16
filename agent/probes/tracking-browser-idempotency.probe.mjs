#!/usr/bin/env node
/**
 * tracking-browser-idempotency.probe.mjs
 *
 * PROVES that one browsing session can no longer become N database rows.
 *
 * WHY THIS EXISTS
 * ---------------
 * The extension sends TWO payload shapes that do not mean the same thing:
 *   periodic   (is_periodic:true,  delta_ms>0) : timestamp = sync time,
 *                                                active_duration_ms = DELTA
 *   tab switch (is_periodic:false, delta_ms:0) : timestamp = session START (constant),
 *                                                active_duration_ms = CUMULATIVE TOTAL
 * Both writers ran `delta_ms || active_duration_ms`, collapsing the two. A tab-switch
 * snapshot re-delivered N times (MV3 service-worker restarts, the extension's retry queue)
 * therefore appended N rows AT THE SAME TIMESTAMP, each carrying the ENTIRE session again.
 *
 * Measured on the live DB before the fix:
 *   60 rows at 2026-10-13T16:15:10.675Z (obsidianui.dev) — every one a full session total
 *  140 rows pinned at exactly 3_600_000 ms
 *   days claiming 139.0 h and 108.1 h
 *
 * The probe runs the REAL ingest() out of the daemon file against a mock logs table, and
 * runs the PRE-FIX BACKUP through the identical payload sequence. If this probe passes on a
 * future version that regressed to appending, check 2 and 5 fail.
 *
 * Run:  node agent/probes/tracking-browser-idempotency.probe.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NEW_PATH = join(homedir(), '.local/share/rheo-tracker/daemon.mjs');
const OLD_PATH = join(process.cwd(), 'agent/backups/20261016-1330-daemon-sleepfix-pre/daemon.mjs');

const INJECTED = [
  'openDb', 'warn', 'log', 'categorizeDomain', 'commitLog', 'updateAggregates',
  'appForBrowser', 'MAX_WRITE_MS', 'BROWSER_DELTA_MAX_MS', 'BROWSER_SESSION_MERGE_WINDOW_MS',
];

let failures = 0;
const results = [];
function check(name, actual, expected, note = '') {
  const ok = actual === expected;
  if (!ok) failures++;
  results.push({ ok, name, actual, expected, note });
}

/** Take the REAL ingest() out of a daemon file, plus the snapshot cap if it declares one. */
function extractIngest(src) {
  const cap = src.indexOf('var BROWSER_SNAPSHOT_MAX_MS');
  const fn = src.indexOf('function ingest(payload)');
  const end = src.indexOf('\nfunction startBrowserServer');
  if (fn < 0 || end < 0) throw new Error(`ingest markers missing (fn=${fn} end=${end})`);
  const start = cap >= 0 && cap < fn ? cap : fn;
  let code = src.slice(start, end);
  for (const n of INJECTED) {
    code = code.replace(new RegExp(`function ${n}\\s*\\(`, 'g'), `function __unused_${n}__(`);
    code = code.replace(new RegExp(`var ${n}\\s*=`, 'g'), `var __unused_${n}__ =`);
  }
  return code;
}

/**
 * A mock `logs` table supporting exactly the statements ingest() issues. Nothing here can
 * touch the real database: there is no file handle, no better-sqlite3, no path.
 */
function makeHarness(src) {
  const rows = [];
  const aggregateCalls = [];
  const logLines = [];
  let nextId = 1;
  const MAX_WRITE = 120 * 60 * 1000;

  const normalize = (s) => s.replace(/\s+/g, ' ').trim();
  const db = {
    prepare(sql) {
      const s = normalize(sql);
      return {
        get(...args) {
          if (/^SELECT id, timestamp, duration_ms FROM logs/i.test(s)) {
            if (/julianday/i.test(s)) {
              // Nearest row for the same domain inside the merge window: the durable
              // equivalent of the app's in-memory session map, used by periodic deltas
              // whose timestamp is their sync time rather than the session start.
              const [domain, timestamp, windowMs] = args;
              const target = Date.parse(timestamp);
              const cands = rows
                .filter((r) => r.is_browser_tracking === 1 && r.domain === domain)
                .map((r) => ({ r, d: Math.abs(Date.parse(r.timestamp) - target) }))
                .filter((x) => x.d <= windowMs)
                .sort((a, b) => a.d - b.d);
              return cands.length ? cands[0].r : undefined;
            }
            const [domain, timestamp] = args;
            const hits = rows.filter(
              (r) => r.is_browser_tracking === 1 && r.domain === domain && r.timestamp === timestamp
            );
            return hits.length ? hits[hits.length - 1] : undefined;
          }
          throw new Error(`mock get: unhandled SQL -> ${s}`);
        },
        run(...args) {
          if (/^UPDATE logs SET duration_ms/i.test(s)) {
            const [duration, title, url, browserName, id] = args;
            const r = rows.find((x) => x.id === id);
            if (!r) throw new Error(`mock run: no row ${id}`);
            r.duration_ms = duration;
            r.title = title;
            r.url = url;
            if (r.browser_name == null) r.browser_name = browserName;
            return { changes: 1 };
          }
          throw new Error(`mock run: unhandled SQL -> ${s}`);
        },
      };
    },
  };

  const code = extractIngest(src);
  const factory = new Function(
    ...INJECTED,
    `${code}\nreturn { ingest };`
  );
  const api = factory(
    () => db,
    () => {},
    (m) => logLines.push(String(m)),
    () => 'other',
    (row, agg) => {
      // Emulate the real commitLog: insert ONE row, capped by the hard write ceiling, and
      // report the same duration to the aggregate tables exactly once.
      rows.push({
        id: nextId++,
        timestamp: row.timestamp,
        app: row.app,
        domain: row.domain,
        duration_ms: Math.min(row.duration_ms, MAX_WRITE),
        title: row.title ?? null,
        url: row.url ?? null,
        browser_name: row.browser_name ?? null,
        is_browser_tracking: row.is_browser_tracking ?? 0,
      });
      aggregateCalls.push({ domain: agg.domain, addMs: agg.duration_ms });
      return true;
    },
    (args) => aggregateCalls.push({ domain: args.domain, addMs: args.duration_ms }),
    (name) => String(name || 'browser').toLowerCase(),
    MAX_WRITE,
    10 * 60 * 1000,
    10 * 60 * 1000,
  );
  return { ingest: api.ingest, rows, aggregateCalls, logLines };
}

const T0 = Date.parse('2026-10-13T16:15:10.675Z');

/** A tab switch at T0, then the same session snapshot re-delivered 59 more times. */
function replayScenario(src) {
  const h = makeHarness(src);
  // 1. First tab-switch snapshot: 2 minutes accumulated on the site so far.
  h.ingest({
    domain: 'obsidianui.dev',
    url: 'https://www.obsidianui.dev/prompts/arix-hero-section',
    title: 'Arix Hero section',
    timestamp: new Date(T0).toISOString(),
    active_duration_ms: 120_000,
    is_periodic: false,
    delta_ms: 0,
    browserName: 'Zen',
    tab_id: 135,
  });
  // 2. The extension re-delivers the SAME session snapshot 59 times, each carrying a
  //    LARGER cumulative total, exactly as the live DB shows (30 s of growth per delivery).
  for (let i = 1; i <= 59; i++) {
    h.ingest({
      domain: 'obsidianui.dev',
      url: 'https://www.obsidianui.dev/prompts/arix-hero-section',
      title: 'Arix Hero section',
      timestamp: new Date(T0).toISOString(), // constant: session START
      active_duration_ms: 120_000 + i * 30_000, // cumulative, keeps growing
      is_periodic: false,
      delta_ms: 0,
      browserName: 'Zen',
      tab_id: 135,
    });
  }
  return h;
}

/** A separate session that reports only periodic deltas, as the extension does every ~30 s. */
function periodicScenario(src) {
  const h = makeHarness(src);
  for (let i = 0; i < 10; i++) {
    h.ingest({
      domain: 'youtube.com',
      url: 'https://youtube.com/watch?v=abc',
      title: 'A video',
      timestamp: new Date(T0 + i * 30_000).toISOString(),
      active_duration_ms: 30_000,
      is_periodic: true,
      delta_ms: 30_000,
      browserName: 'Firefox',
    });
  }
  return h;
}

// ---------------------------------------------------------------------------------------
console.log('tracking-browser-idempotency.probe — one session must be ONE row\n');

if (!existsSync(NEW_PATH)) { console.error(`  FATAL: live daemon not found at ${NEW_PATH}`); process.exit(2); }

const NEW = replayScenario(readFileSync(NEW_PATH, 'utf8'));
const OLD = existsSync(OLD_PATH) ? replayScenario(readFileSync(OLD_PATH, 'utf8')) : null;
const NEWPER = periodicScenario(readFileSync(NEW_PATH, 'utf8'));

const newTotal = NEW.rows.reduce((a, r) => a + r.duration_ms, 0);
console.log(`  FIXED   replay: rows=${NEW.rows.length}  credited=${newTotal}ms (${(newTotal / 1000).toFixed(0)}s)`);
if (OLD) {
  const oldTotal = OLD.rows.reduce((a, r) => a + r.duration_ms, 0);
  console.log(`  PRE-FIX replay: rows=${OLD.rows.length}  credited=${oldTotal}ms (${(oldTotal / 3600000).toFixed(1)}h)`);
}
console.log(`  FIXED   periodic: rows=${NEWPER.rows.length}  credited=${NEWPER.rows.reduce((a, r) => a + r.duration_ms, 0)}ms`);
console.log('');

// 1. 60 deliveries of one session collapse to exactly one row.
check('1. 60 re-deliveries of one session produce ONE row', NEW.rows.length, 1,
  `${NEW.rows.length} row(s) for a single (domain, session-start)`);
// 2. The credited total is the session total, never the sum of every delivery.
check('2. credited total equals the session total, not the sum', newTotal, 120_000 + 59 * 30_000,
  `expected the largest cumulative (${120_000 + 59 * 30_000}ms), got ${newTotal}ms`);
// 3. The old code must reproduce the blow-up this probe exists to catch.
if (OLD) {
  check('3. PRE-FIX code writes 60 rows (probe fails on old code)', OLD.rows.length, 60);
}
// 4. A snapshot must never be ADDED.
check('4. no snapshot was added (sum != N x cumulative)', newTotal === 60 * 120_000, false);
// 5. The browser is recorded — the daemon previously had no browser_name column at all.
check('5. browser_name is recorded on the row', NEW.rows[0]?.browser_name, 'Zen');
// 6. app is the domain, matching the app's own writer shape.
check('6. app carries the domain (one canonical row shape)', NEW.rows[0]?.app, 'obsidianui.dev');
// 7. Periodic deltas still accumulate — the fix must not stop real time being counted.
check('7. 10 periodic deltas accumulate into one row', NEWPER.rows.length, 1,
  `${NEWPER.rows.length} row(s) for a periodic-only session`);
check('8. periodic deltas sum correctly (10 x 30s)', NEWPER.rows.reduce((a, r) => a + r.duration_ms, 0), 300_000);
// 9. Aggregate deltas must equal credited time EXACTLY ONCE. A snapshot that merely
//    re-states a total it already reported must contribute nothing to them.
const aggTotal = NEW.aggregateCalls.reduce((a, c) => a + c.addMs, 0);
check('9. aggregate deltas equal credited time (no double count)', aggTotal, newTotal,
  `aggregates received ${aggTotal}ms while the rows credited ${newTotal}ms`);
const aggPeriodic = NEWPER.aggregateCalls.reduce((a, c) => a + c.addMs, 0);
check('10. periodic aggregates equal the credited total', aggPeriodic, 300_000);
// 11-14. Re-delivering an UNCHANGED snapshot must be a strict no-op, and must say so.
//        (In the replay above every snapshot raises the total, so none of them is a
//        duplicate -- the no-op path only exists for a true re-delivery.)
{
  const h = makeHarness(readFileSync(NEW_PATH, 'utf8'));
  const payload = {
    domain: 'example.com',
    url: 'https://example.com/',
    title: 'Example',
    timestamp: new Date(T0).toISOString(),
    active_duration_ms: 60_000,
    is_periodic: false,
    delta_ms: 0,
    browserName: 'Zen',
  };
  h.ingest(payload);
  h.ingest({ ...payload });
  h.ingest({ ...payload });
  check('11. an unchanged snapshot re-delivered twice stays ONE row', h.rows.length, 1,
    `${h.rows.length} row(s)`);
  check('12. the no-op is reported, not swallowed', h.logLines.some((l) => /duplicate snapshot ignored/.test(l)), true);
  check('13. the no-op credits no extra time', h.rows.reduce((a, r) => a + r.duration_ms, 0), 60_000);
  check('14. the no-op adds nothing to aggregates', h.aggregateCalls.reduce((a, c) => a + c.addMs, 0), 60_000);
}

// ---------------------------------------------------------------------------------------
console.log('  assertions:');
for (const r of results) {
  console.log(`   ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n           ${r.note}` : ''}`);
}
console.log('');
const passed = results.filter((r) => r.ok).length;
console.log(`  ${passed}/${results.length} passed  |  ${failures === 0 ? 'PROBE PASS' : 'PROBE FAIL'}`);
process.exit(failures === 0 ? 0 : 1);
