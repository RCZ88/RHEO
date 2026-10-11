/**
 * "62% accounted for" must not double count, and must not blame the user for
 * time before the tracker was ever running.
 */
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

function compute(gaps: any[], startMs: number, nowMs: number) {
  const relevant = gaps
    .map((g) => ({ g, s: new Date(g.start).getTime(), e: new Date(g.end).getTime() }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.e) && x.e > startMs && x.e > x.s);
  const merged: { s: number; e: number }[] = [];
  for (const x of relevant.sort((a, b) => a.s - b.s)) {
    const last = merged[merged.length - 1];
    if (last && x.s <= last.e) last.e = Math.max(last.e, x.e);
    else merged.push({ s: x.s, e: x.e });
  }
  const missing = merged.reduce((sum, m) => sum + (m.e - m.s), 0);
  const win = Math.max(1, nowMs - startMs);
  const pct = Math.min(100, Math.max(0, (missing / win) * 100));
  return { missing, win, trackedPct: 100 - pct, missingPct: pct, count: merged.length };
}

const NOW = Date.parse('2026-10-08T20:00:00Z');
const DAY = Date.parse('2026-10-08T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const gap = (a: number, b: number) => ({ start: iso(a), end: iso(b), durationSeconds: (b - a) / 1000 });

console.log('nothing missed -> 100%:');
const clean = compute([], DAY, NOW);
ok(clean.trackedPct === 100, `tracked = ${clean.trackedPct}%`);
ok(clean.count === 0, 'no gaps');

console.log('\na single gap is counted once:');
const one = compute([gap(NOW - 3600e3, NOW)], DAY, NOW);
ok(Math.abs(one.missing - 3600e3) < 1, 'missing = 1h');
ok(Math.abs(one.missingPct - (3600e3 / (NOW - DAY)) * 100) < 0.01, `missing = ${one.missingPct.toFixed(2)}%`);

console.log('\nOVERLAPPING gaps must not double count:');
const overlap = compute(
  [gap(NOW - 7200e3, NOW - 3600e3), gap(NOW - 5400e3, NOW - 1800e3)],
  DAY, NOW,
);
ok(overlap.count === 1, 'two overlapping gaps merge into 1');
ok(Math.abs(overlap.missing - 5400e3) < 1, 'union duration, not the sum (90m not 120m)');

console.log('\nfully nested gaps do not inflate the total:');
const nested = compute(
  [gap(NOW - 7200e3, NOW), gap(NOW - 3600e3, NOW - 1800e3)],
  DAY, NOW,
);
ok(Math.abs(nested.missing - 7200e3) < 1, 'inner gap absorbed into the outer one');

console.log('\ntime before the window opened is not held against you:');
const preWindow = compute([gap(DAY - 7200e3, DAY - 3600e3)], DAY, NOW);
ok(preWindow.count === 0, 'a gap that ended before the window is ignored');
ok(preWindow.trackedPct === 100, 'still 100% accounted for');

console.log('\nmalformed input cannot produce NaN on screen:');
const bad = compute([{ start: 'nope', end: 'nope', durationSeconds: 9999 } as any], DAY, NOW);
ok(bad.count === 0 && !Number.isNaN(bad.trackedPct), 'garbage gap dropped, percentage still a number');
const inverted = compute([gap(NOW, NOW - 3600e3)], DAY, NOW);
ok(inverted.count === 0 && !Number.isNaN(inverted.trackedPct), 'end before start dropped');

console.log('\nthe percentage can never leave 0..100:');
const huge = compute([gap(DAY, NOW)], DAY, NOW);
ok(huge.missingPct === 100 && huge.trackedPct === 0, 'a fully missed window reads 0%, not -N%');
const zeroWindow = compute([], NOW, NOW);
ok(Number.isFinite(zeroWindow.trackedPct), 'a zero-length window does not divide by zero');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
