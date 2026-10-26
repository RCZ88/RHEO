#!/usr/bin/env node
/**
 * afk-input-daemon.probe.mjs
 *
 * PROVES the AFK rule the user reported broken:
 *
 *   "when im no longer afk, it still counts it as afk until i enter or like
 *    click and view the app"
 *
 * The old daemon stayed in AFK until a DIFFERENT app became focused, so typing
 * in the window that was already open — or simply coming back to the machine —
 * left it AFK indefinitely. The new rule ends AFK on real device input, which is
 * injected here through `getSystemInputIdleMs`.
 *
 * Like the sleep probe, this extracts the REAL `feed`/`flush`/`reset` out of the
 * deployed bundle and runs them under a fake clock with a stubbed `commitLog`,
 * so it cannot write to the live database.
 *
 * Run: node agent/probes/afk-input-daemon.probe.mjs
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DAEMON = join(homedir(), '.local/share/rheo-tracker/daemon.mjs');

const INJECTED = [
  'commitLog', 'categorizeApp', 'warn', 'log', 'emitAfkEvent',
  'getSystemInputIdleMs',
  'KEEPALIVE_NULL_POLLS', 'KEEPALIVE_EXTEND_MS', 'Date',
  'stats', 'afkState', 'afkStartMs',
];

function extract(src) {
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
  const constants = consume('var POLL_INTERVAL_MS');
  const state = consume('var open = null;');
  const e = src.indexOf('function flush(');
  const f = src.indexOf('function reset()');
  if (e < 0 || f < 0) throw new Error('flush/reset markers missing');
  let code = `${constants}\n${state}\n${src.slice(e, f)}\n`;
  for (const n of INJECTED) {
    code = code.replace(new RegExp(`function ${n}\\s*\\(`, 'g'), `function __unused_${n}__(`);
    code = code.replace(new RegExp(`var ${n}\\s*=`, 'g'), `var __unused_${n}__ =`);
  }
  return code;
}

const src = readFileSync(DAEMON, 'utf8');
const code = extract(src);

let fakeNow = 1_760_000_000_000;
let inputIdleMs = 0;
class FakeDate extends Date { static now() { return fakeNow; } }

const rows = [];
const afkEvents = [];
const warns = [];
const stats = { polls: 0, rowsWritten: 0, lastRow: null, lastSuccessfulPollAt: null };
let afkState = 'active';
let afkStartMs = 0;

const factory = new Function(
  ...INJECTED,
  `${code}
   return { feed, flush, peekOpen: () => open, getAfk: () => ({ afkState, afkStartMs }) };`,
);

const api = factory(
  (row) => { rows.push({ app: row.app, duration_ms: row.duration_ms }); return true; },
  () => 'Productivity',
  (...a) => warns.push(a.join(' ')),
  () => {},
  (e) => afkEvents.push(e),
  () => inputIdleMs,
  3,
  60_000,
  FakeDate,
  stats,
  'active',
  0,
);

function observe(app) {
  api.feed({ ok: true, observation: { app, title: `${app} title` } });
}
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n           ${detail}` : ''}`);
  return ok ? 0 : 1;
}

let failures = 0;
const MIN = 60_000;

console.log('afk-input-daemon.probe — AFK must end on INPUT, not on a window change\n');

// 0:00 — user works in konsole. Input is live.
observe('konsole');
const started = fakeNow;
console.log(`  ..    t+0m observe konsole (input idle 0s), open=${api.peekOpen()?.app}`);

// 1:00 — still working, input two seconds ago.
fakeNow = started + 1 * MIN;
inputIdleMs = 2_000;
observe('konsole');

// 6:00 — no input for six minutes. AFK must start, timer stops.
fakeNow = started + 6 * MIN;
inputIdleMs = 6 * MIN;
observe('konsole');
const afkStartEvent = afkEvents.find((e) => e.type === 'afk_start');
failures += check(
  '1. AFK starts after 5 min of real device idle',
  !!afkStartEvent,
  afkStartEvent ? `afkStartMs=${new Date(afkStartEvent.afkStartMs).toISOString()}` : 'no afk_start',
);
failures += check(
  '2. AFK start is measured from the LAST INPUT, not poll time',
  !!afkStartEvent && afkStartEvent.afkStartMs === fakeNow - 6 * MIN,
  afkStartEvent ? `start=${fakeNow - afkStartEvent.afkStartMs}ms before poll (expected 360000)` : '',
);
failures += check('3. no session is open during AFK', api.peekOpen() === null);

// 6:30 — still away, the poll keeps running. A "still AFK" tick must not be
// mistaken for a fresh observation and reopen a session.
fakeNow = started + 6 * MIN + 30_000;
inputIdleMs = 6 * MIN + 30_000;
observe('konsole');
failures += check('3b. a later AFK poll does not reopen a session', api.peekOpen() === null,
  `open=${api.peekOpen()?.app ?? null}`);

// 6:40 — the user types in the SAME app. No foreground change at all.
const sameApp = 'konsole';
fakeNow = started + 6 * MIN + 40_000;
inputIdleMs = 1_000;
observe(sameApp);

const afkEndEvent = afkEvents.find((e) => e.type === 'afk_end');
failures += check(
  `4. AFK ends on input while the SAME app (${sameApp}) stays focused`,
  !!afkEndEvent,
  afkEndEvent ? `duration=${Math.round(afkEndEvent.durationMs / 1000)}s` : 'no afk_end — the reported bug',
);
failures += check('5. a fresh session opens immediately after the input', api.peekOpen()?.app === sameApp,
  `open=${api.peekOpen()?.app ?? null}`);
failures += check('6. the absence is not credited as a session', rows.reduce((s, r) => s + r.duration_ms, 0) <= 6 * MIN,
  `credited=${rows.reduce((s, r) => s + r.duration_ms, 0)}ms across ${rows.length} row(s)`);
failures += check('7. the AFK flag is cleared', api.getAfk().afkState === 'active');

// 8 — a null observation after input must still end AFK (compositor hiccup).
fakeNow = started + 7 * MIN;
inputIdleMs = 10 * MIN; // no input since the last observation
observe('konsole');
fakeNow = started + 13 * MIN;
inputIdleMs = 6 * MIN;
observe('konsole');
const before = afkEvents.filter((e) => e.type === 'afk_end').length;
fakeNow = started + 13 * MIN + 2_000;
inputIdleMs = 0;
api.feed({ ok: true, observation: null });
failures += check(
  '8. input with no visible window still ends AFK',
  afkEvents.filter((e) => e.type === 'afk_end').length === before + 1,
);

// 9 — a failed poll is not input and must not end AFK.
fakeNow = started + 20 * MIN;
inputIdleMs = 13 * MIN;
observe('konsole');
const beforeFail = afkEvents.filter((e) => e.type === 'afk_end').length;
api.feed({ ok: false, observation: null });
failures += check('9. a failed poll does not count as activity', afkEvents.filter((e) => e.type === 'afk_end').length === beforeFail);

console.log(`\nRESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} (10 checks)`);
process.exit(failures === 0 ? 0 : 1);
