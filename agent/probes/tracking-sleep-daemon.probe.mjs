#!/usr/bin/env node
/**
 * tracking-sleep-daemon.probe.mjs
 *
 * PROVES the suspend fix in the rheo-tracker daemon, and proves it the hard way.
 *
 * WHY THIS EXISTS
 * ---------------
 * The daemon awarded a fabricated usage row for every suspend: `feed()` advanced
 * `lastPollMs = now` BEFORE calling `flush()`, and `flush()` then derived its end time
 * from that already-advanced clock. A three-hour sleep was therefore measured as a
 * three-hour session and truncated to exactly 3_600_000 ms by a 60-minute cap, which is
 * why the lie looked plausible. The live DB held 133 such rows across only 9 timestamps,
 * and days claiming 139.0 h and 108.1 h.
 *
 * A probe that only asserts the new function exists proves nothing. So this one:
 *   1. extracts the REAL flush()/feed() out of the live daemon file and runs them under a
 *      fake clock (not a re-implementation of the logic — the actual shipped source);
 *   2. runs the PRE-FIX BACKUP of the same file through the IDENTICAL scenario;
 *   3. asserts the two disagree, and that the pre-fix code is the one producing 3_600_000 ms.
 *
 * If a future edit reintroduces the ordering bug, check 5 fails and says so.
 *
 * Run:  node agent/probes/tracking-sleep-daemon.probe.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const NEW_PATH = join(homedir(), '.local/share/rheo-tracker/daemon.mjs');
const OLD_PATH = join(process.cwd(), 'agent/backups/20261016-1330-daemon-sleepfix-pre/daemon.mjs');

// Everything flush()/feed() touch that lives OUTSIDE the extracted slices. Each is injected
// as a `new Function` parameter, so the sandbox holds no real DB handle and CANNOT write.
const INJECTED = [
  'commitLog', 'categorizeApp', 'warn', 'log', 'emitAfkEvent',
  'KEEPALIVE_NULL_POLLS', 'KEEPALIVE_EXTEND_MS', 'Date',
  'stats', 'afkState', 'afkStartMs',
];

let failures = 0;
const results = [];
function check(name, actual, expected, note = '') {
  const ok = actual === expected;
  if (!ok) failures++;
  results.push({ ok, name, actual, expected, note });
}

/** Pull the REAL declarations out of a daemon file, in three disjoint slices. */
function extract(src) {
  // Three PRECISE slices. A single wide span is NOT safe here: the bundled daemon file has
  // top-level ESM `import` statements interleaved with its declarations, and `new Function`
  // rejects those outright ("Cannot use import statement outside a module").
  const consume = (marker) => {
    const lines = src.split('\n');
    const start = lines.findIndex((l) => l.includes(marker));
    if (start < 0) throw new Error(`extraction marker not found: ${marker}`);
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === '' || t.startsWith('//') || /^var\s/.test(t)) { out.push(lines[i]); continue; }
      break;
    }
    return out.join('\n');
  };
  const constants = consume('var POLL_INTERVAL_MS');   // tuning constants + comments
  const state = consume('var open = null;');           // session + both clocks
  const e = src.indexOf('function flush(');
  const f = src.indexOf('function reset()');
  if (e < 0 || f < 0) throw new Error('flush/reset markers missing');
  let code = `${constants}\n${state}\n${src.slice(e, f)}\n`;
  // Neutralise any real definition of a name we inject, so our stub is what resolves.
  // Without this the real commitLog would shadow the stub and write to the LIVE database.
  for (const n of INJECTED) {
    code = code.replace(new RegExp(`function ${n}\\s*\\(`, 'g'), `function __unused_${n}__(`);
    code = code.replace(new RegExp(`var ${n}\\s*=`, 'g'), `var __unused_${n}__ =`);
  }
  return code;
}

function makeHarness(src, t0) {
  const code = extract(src);
  const isNewApi = src.includes('result.ok !== true');
  const rows = [];
  const warns = [];
  let fakeNow = t0;
  class FakeDate extends Date {
    static now() { return fakeNow; }
  }
  const factory = new Function(
    ...INJECTED,
    `${code}
     // Defensive so the SAME harness can drive the pre-fix file, which has one clock
     // named lastPollMs instead of the two named clocks introduced by the fix.
     const clocks = () => ({
       att: (typeof lastPollAttemptMs !== 'undefined') ? lastPollAttemptMs
            : (typeof lastPollMs !== 'undefined' ? lastPollMs : 0),
       succ: (typeof lastSuccessfulObservationMs !== 'undefined') ? lastSuccessfulObservationMs
             : (typeof lastPollMs !== 'undefined' ? lastPollMs : 0)
     });
     return { feed, flush, peekOpen: () => open, clocks };`
  );
  const stats = { polls: 0, rowsWritten: 0, lastRow: null, lastSuccessfulPollAt: null };
  const api = factory(
    (row, agg) => { rows.push({ duration_ms: row.duration_ms, app: row.app, timestamp: row.timestamp, ...agg }); return true; },
    () => 'other',
    (...a) => warns.push(a.join(' ')),
    () => {},
    () => {},
    3,        // KEEPALIVE_NULL_POLLS
    60_000,   // KEEPALIVE_EXTEND_MS
    FakeDate,
    stats,
    'active', // afkState
    0,        // afkStartMs
  );
  return {
    api, rows, warns, isNewApi,
    setNow: (t) => { fakeNow = t; },
    getNow: () => fakeNow,
    // Drive whichever calling convention this version of the file uses.
    observe: (obs) => (isNewApi ? api.feed({ ok: true, observation: obs }) : api.feed(obs)),
    failPoll: () => { if (isNewApi) api.feed({ ok: false }); },
  };
}

const T0 = 1_760_000_000_000;
const THREE_HOURS = 3 * 3600_000;

/**
 * The exact failure the user reported: work on one app, suspend for three hours, wake.
 * A correct writer credits only the time it actually observed.
 */
function suspendScenario(src, label) {
  const h = makeHarness(src, T0);
  h.setNow(T0);
  h.observe({ app: 'konsole', title: 'bash' });      // session opens at T0
  h.setNow(T0 + 1000);
  h.observe({ app: 'konsole', title: 'bash' });      // last confirmed observation: T0+1s
  const beforeSuspend = h.api.clocks();
  h.setNow(T0 + 1000 + THREE_HOURS);                 // <-- three hours asleep
  h.observe({ app: 'konsole', title: 'bash' });      // first poll after wake
  h.api.flush('probe end', h.getNow());
  return { h, label, beforeSuspend, written: h.rows.map((r) => r.duration_ms) };
}

// ---------------------------------------------------------------------------------------
console.log('tracking-sleep-daemon.probe — suspend must contribute ZERO credited usage\n');

if (!existsSync(NEW_PATH)) { console.error(`  FATAL: live daemon not found at ${NEW_PATH}`); process.exit(2); }

const NEW = suspendScenario(readFileSync(NEW_PATH, 'utf8'), 'FIXED');
const OLD = existsSync(OLD_PATH)
  ? suspendScenario(readFileSync(OLD_PATH, 'utf8'), 'PRE-FIX')
  : null;

const newTotal = NEW.written.reduce((a, b) => a + b, 0);
console.log(`  FIXED   rows written: ${JSON.stringify(NEW.written)}  total=${newTotal}ms  ${newTotal / 1000}s`);
if (OLD) {
  const oldTotal = OLD.written.reduce((a, b) => a + b, 0);
  console.log(`  PRE-FIX rows written: ${JSON.stringify(OLD.written)}  total=${oldTotal}ms  ${(oldTotal / 3600000).toFixed(2)}h`);
}
console.log('');

// 1. The fabricated one-hour row must be gone.
check('1. fixed writer emits NO 3_600_000 ms sleep-cap row', NEW.written.includes(3_600_000), false);
// 2. The credited duration must be a small, real observation, not the sleep span.
check('2. fixed writer credits < 5s (real observation only)', newTotal < 5000, true,
  `credited ${newTotal}ms out of a ${THREE_HOURS}ms sleep`);
// 3. It must credit exactly what it observed: T0 -> T0+1000.
check('3. fixed writer credits exactly the observed 1000ms', newTotal, 1000);
// 4. It must not exceed the last confirmed observation.
check('4. credited end == lastSuccessfulObservationMs', newTotal <= NEW.h.api.clocks().succ - T0, true);
// 5. THE DIFFERENTIAL: the pre-fix code must produce the lie this probe exists to catch.
if (OLD) {
  check('5. PRE-FIX code DOES produce 3_600_000 ms (probe fails on old code)', OLD.written.includes(3_600_000), true,
    'if this is false the scenario no longer reproduces the bug');
} else {
  results.push({ ok: false, name: '5. PRE-FIX backup present', actual: 'missing', expected: 'present', note: OLD_PATH });
  failures++;
}

// 6. A failed poll must not advance the success clock.
{
  const h = makeHarness(readFileSync(NEW_PATH, 'utf8'), T0);
  h.setNow(T0);
  h.observe({ app: 'konsole', title: 'bash' });
  h.setNow(T0 + 1000);
  h.observe({ app: 'konsole', title: 'bash' });
  const succBefore = h.api.clocks().succ;
  const attBefore = h.api.clocks().att;
  h.setNow(T0 + 60_000);
  h.failPoll();
  const after = h.api.clocks();
  check('6. failed poll advances the ATTEMPT clock', after.att > attBefore, true, `att ${attBefore} -> ${after.att}`);
  check('7. failed poll does NOT advance the SUCCESS clock', after.succ === succBefore, true, `succ ${succBefore} -> ${after.succ}`);
  h.api.flush('probe end');
  const credited = h.rows.reduce((a, r) => a + r.duration_ms, 0);
  check('8. time covered only by failed polls is credited as ZERO', credited, 1000);
}

// 9. A succeeded "nothing trackable in front" is NOT a failure. It advances the success
//    clock, but it must not credit an unobserved span.
//
//    ON THE RESIDUAL: the daemon deliberately holds a session open across a few null polls
//    (KEEPALIVE_NULL_POLLS) so a momentary X11 blip does not fragment a session. That grace
//    is pre-existing, bounded to a couple of seconds in real operation, and is NOT the bug
//    this probe exists to catch. What must hold is that a LONG unobserved span contributes
//    nothing — so the scenario below follows the null poll with a three-hour gap.
{
  const h = makeHarness(readFileSync(NEW_PATH, 'utf8'), T0);
  h.setNow(T0);
  h.observe({ app: 'konsole', title: 'bash' });
  h.setNow(T0 + 1000);
  h.observe({ app: 'konsole', title: 'bash' });
  const succBefore = h.api.clocks().succ;
  h.setNow(T0 + 9000);
  h.observe(null);                                  // successful look, no trackable app
  check('9. {ok:true, observation:null} DOES advance the success clock', h.api.clocks().succ > succBefore, true);
  h.setNow(T0 + 9000 + THREE_HOURS);                // then a long unobserved span
  h.observe(null);
  h.api.flush('probe end');
  const credited = h.rows.reduce((a, r) => a + r.duration_ms, 0);
  check('10. a 3h gap after a no-app observation is NOT credited', credited, 9000,
    `credited ${credited}ms of real observation; the ${THREE_HOURS}ms span after the last success contributed 0`);
}

// 11. Repeated flush must not double-write the same session.
{
  const h = makeHarness(readFileSync(NEW_PATH, 'utf8'), T0);
  h.setNow(T0);
  h.observe({ app: 'konsole', title: 'bash' });
  h.setNow(T0 + 1000);
  h.observe({ app: 'konsole', title: 'bash' });
  h.api.flush('first');
  h.api.flush('second');
  h.api.flush('third');
  check('11. repeated flush writes exactly one row', h.rows.length, 1);
}

// 12. The sleep gap must actually be DETECTED (checked before the attempt clock moves).
{
  const h = makeHarness(readFileSync(NEW_PATH, 'utf8'), T0);
  h.setNow(T0);
  h.observe({ app: 'konsole', title: 'bash' });
  h.setNow(T0 + 1000);
  h.observe({ app: 'konsole', title: 'bash' });
  h.setNow(T0 + 1000 + THREE_HOURS);
  h.observe({ app: 'konsole', title: 'bash' });
  const re = h.warns.filter((w) => /gap/i.test(w));
  check('12. the 3h gap IS detected and reported', re.length > 0, true, re[0] ? re[0].slice(0, 90) : 'no gap warning');
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
