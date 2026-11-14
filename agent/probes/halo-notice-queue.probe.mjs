/**
 * HALO_FIT ranks 6-8 — the notice model probe.
 * Bundles the REAL src/shared/halo/noticeModel.ts via a temp entry, asserts every
 * firing rule with printed numbers. No Date.now() in the module — all times injected.
 */
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const dir = '/tmp/opencode/halo-check/notice-probe';
mkdirSync(dir, { recursive: true });
writeFileSync(dir + '/entry.ts', "export * from '/home/clementzhao/dev/rheo/src/shared/halo/noticeModel';");
await build({
  entryPoints: [dir + '/entry.ts'],
  bundle: true,
  format: 'esm',
  outfile: dir + '/noticeModel.mjs',
  logLevel: 'silent',
});

const M = await import(dir + '/noticeModel.mjs');
let pass = 0, fail = 0;
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name} ${detail}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail}`); }
};

/* ── formatStreak ── */
console.log('formatStreak:');
ok(M.formatStreak(4 * 60_000) === '4m', '4m', M.formatStreak(4 * 60_000));
ok(M.formatStreak(112 * 60_000) === '1h 52m', '1h 52m', M.formatStreak(112 * 60_000));
ok(M.formatStreak(120 * 60_000) === '2h', '2h exact hour', M.formatStreak(120 * 60_000));
ok(M.formatStreak(0) === '0m', '0m clamp', M.formatStreak(0));
ok(M.formatStreak(-5_000) === '0m', 'negative clamps', M.formatStreak(-5_000));

/* ── drift ── */
console.log('drift:');
const t0 = 1_000_000;
let d = M.driftNotice({ tier: 'distracting', streakMs: 2 * 60_000, sessionActive: false, away: false, shownForSinceMs: 0, sinceMs: t0 });
ok(d === null, 'silent under 3min', '2min streak');
d = M.driftNotice({ tier: 'distracting', streakMs: 3 * 60_000 + 1, sessionActive: false, away: false, shownForSinceMs: 0, sinceMs: t0 });
ok(d !== null && d.notice.payload.label === 'Drifting' && d.notice.payload.mono === '3m' && d.notice.payload.tone === 'warn', 'fires at 3min', JSON.stringify(d?.notice.payload));
ok(d.notice.durationMs === 8_000, '8s hold', String(d.notice.durationMs));
const d2 = M.driftNotice({ tier: 'distracting', streakMs: 5 * 60_000, sessionActive: false, away: false, shownForSinceMs: d.shownForSinceMs, sinceMs: t0 });
ok(d2 === null, 'not twice per streak', 'shownForSinceMs matches');
const d3 = M.driftNotice({ tier: 'distracting', streakMs: 4 * 60_000, sessionActive: false, away: false, shownForSinceMs: t0, sinceMs: t0 + 7 * 60_000 });
ok(d3 !== null, 'new streak re-fires', 'sinceMs changed');
ok(M.driftNotice({ tier: 'productive', streakMs: 10 * 60_000, sessionActive: false, away: false, shownForSinceMs: 0, sinceMs: t0 }) === null, 'silent on productive');
ok(M.driftNotice({ tier: 'distracting', streakMs: 10 * 60_000, sessionActive: true, away: false, shownForSinceMs: 0, sinceMs: t0 }) === null, 'silent in focus session');
ok(M.driftNotice({ tier: 'distracting', streakMs: 10 * 60_000, sessionActive: false, away: true, shownForSinceMs: 0, sinceMs: t0 }) === null, 'silent while away');
ok(M.driftNotice({ tier: 'distracting', streakMs: 10 * 60_000, sessionActive: false, away: false, shownForSinceMs: 0, sinceMs: 0 }) === null, 'silent when streak clock unknown');

/* ── break due ── */
console.log('breakDue:');
const T = 10_000_000_000; /* large enough that minutes-wide windows stay positive */
let b = M.breakDueNotice({ lastRestAtMs: T - 89 * 60_000, lastNudgeAtMs: 0, breakLive: false, away: false }, T);
ok(b === null, 'silent at 89min');
b = M.breakDueNotice({ lastRestAtMs: T - 90 * 60_000, lastNudgeAtMs: 0, breakLive: false, away: false }, T);
ok(b !== null && b.notice.payload.label === 'Break due' && b.notice.payload.mono === '1h 30m', 'fires at 90min', JSON.stringify(b?.notice.payload));
ok(b.notice.payload.tone === 'dim' && b.notice.durationMs === 8_000, 'dim tone, 8s');
const b2 = M.breakDueNotice({ lastRestAtMs: T - 95 * 60_000, lastNudgeAtMs: b.lastNudgeAtMs, breakLive: false, away: false }, T + 5 * 60_000);
ok(b2 === null, 'no repeat within interval', '5min after fire');
const b3 = M.breakDueNotice({ lastRestAtMs: T - 180 * 60_000, lastNudgeAtMs: T - 90 * 60_000, breakLive: false, away: false }, T);
ok(b3 !== null, 'repeats each 90min');
ok(M.breakDueNotice({ lastRestAtMs: T - 200 * 60_000, lastNudgeAtMs: 0, breakLive: true, away: false }, T) === null, 'silent during break');
ok(M.breakDueNotice({ lastRestAtMs: T - 200 * 60_000, lastNudgeAtMs: 0, breakLive: false, away: true }, T) === null, 'silent while away');
ok(M.breakDueNotice({ lastRestAtMs: 0, lastNudgeAtMs: 0, breakLive: false, away: false }, T) === null, 'silent when lastRest unknown');

/* ── break over ── */
console.log('breakOver:');
const bo = M.breakOverNotice(false);
ok(bo !== null && bo.payload.label === 'Break over' && bo.payload.icon === 'coffee' && bo.durationMs === 4_000, '4s on natural expiry');
ok(M.breakOverNotice(true) === null, 'null on ended early');

/* ── recap ── */
console.log('recap:');
const buckets = { productiveMs: 20 * 60_000, neutralMs: 3 * 60_000, distractingMs: 2 * 60_000 };
let r = M.recapNotice({ prevResetCount: 2, nextResetCount: 2, prev: buckets });
ok(r === null, 'equal counts → silent');
r = M.recapNotice({ prevResetCount: 2, nextResetCount: 3, prev: null });
ok(r === null, 'no cached buckets → silent');
r = M.recapNotice({ prevResetCount: 2, nextResetCount: 3, prev: { productiveMs: 0, neutralMs: 0, distractingMs: 0 } });
ok(r === null, 'zero total → silent', 'recapping 0m · 0% would be a lie');
r = M.recapNotice({ prevResetCount: 2, nextResetCount: 3, prev: buckets });
ok(r !== null && r.payload.label === '20m · 80% productive' && r.payload.icon === 'check' && r.payload.tone === 'ok', '20m · 80% productive', JSON.stringify(r?.payload));
ok(r.durationMs === 4_000, '4s hold');
r = M.recapNotice({ prevResetCount: 2, nextResetCount: 3, prev: { productiveMs: 1.5 * 60_000, neutralMs: 0, distractingMs: 1.5 * 60_000 } });
ok(r !== null && r.payload.label === '2m · 50% productive', 'rounds minutes', r?.payload.label);
r = M.recapNotice({ prevResetCount: 2, nextResetCount: 3, prev: { productiveMs: 20 * 60_000, neutralMs: NaN, distractingMs: 0 } });
ok(r === null, 'non-finite bucket → silent');

/* ── resume ── */
console.log('resume:');
const rn = M.resumeNotice('  check the audit log  ');
ok(rn !== null && rn.payload.label === 'check the audit log' && rn.payload.icon === 'note' && rn.durationMs === 8_000, 'trims, 8s, note icon');
ok(M.resumeNotice('   ') === null, 'blank → silent');
ok(M.resumeNotice(undefined) === null, 'undefined → silent');

/* ── capture ack ── */
console.log('captureAck:');
const ack = M.captureAckNotice(false);
ok(ack.payload.label === 'Saved to Life' && ack.payload.icon === 'check' && ack.payload.tone === 'ok' && ack.durationMs === 3_000, 'plain ack 3s');
ok(M.captureAckNotice(true).payload.label === 'Saved · pick up here', 'resume-prefixed ack');

/* ── constants ── */
console.log('constants:');
ok(M.NOTICE_HOLD.driftMs === 8_000 && M.NOTICE_HOLD.breakDueMs === 8_000 && M.NOTICE_HOLD.breakOverMs === 4_000 && M.NOTICE_HOLD.resumeMs === 8_000 && M.NOTICE_HOLD.captureAckMs === 3_000 && M.NOTICE_HOLD.recapMs === 4_000, 'spec holds');
ok(M.DRIFT_AFTER_MS === 180_000 && M.BREAK_DUE_INTERVAL_MS === 5_400_000, '3min drift / 90min due');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
