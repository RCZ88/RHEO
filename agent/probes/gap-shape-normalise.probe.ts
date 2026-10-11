/**
 * Every gap producer disagrees about shape, and the disagreement was silently fatal.
 *
 * computeAdjacentGaps / detectUsageGaps both return ISO STRINGS and `durationSeconds`.
 * The dev/inject paths return `Date` objects and `duration_seconds`. Consumers call
 * `gap.start.getTime()`, so a raw string threw `gap.start.getTime is not a function`
 * and `duration_seconds` was undefined on exactly the paths that skipped the manual
 * `new Date()` conversion.
 *
 * enqueueGapFill now coerces once, at the choke point.
 */

// ── extracted from src/App.tsx ────────────────────────────────────────────────
type Any = { start: Date | string; end: Date | string; duration_seconds?: number; durationSeconds?: number };
function normalise(gaps: Any[]) {
  return gaps.map((g, i) => {
    const start = g.start instanceof Date ? g.start : new Date(g.start);
    const end = g.end instanceof Date ? g.end : new Date(g.end);
    const declared = g.duration_seconds ?? g.durationSeconds;
    const duration_seconds =
      typeof declared === 'number' && Number.isFinite(declared)
        ? declared
        : Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
    return { id: `x-${i}`, start, end, duration_seconds };
  }).filter(Boolean) as Array<{ id: string; start: Date; end: Date; duration_seconds: number }>;
}
// ─────────────────────────────────────────────────────────────────────────────

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

console.log('THE CRASH: a string start must become a Date the consumer can call getTime() on:');
const strGap = { start: '2026-10-03T22:00:00.000Z', end: '2026-10-03T22:45:00.000Z', durationSeconds: 2700 };
const [n1] = normalise([strGap]);
ok(n1.start instanceof Date, 'start is a real Date');
ok(typeof n1.start.getTime === 'function', 'gap.start.getTime() exists — the reported crash is gone');
ok(n1.start.getTime() === Date.parse('2026-10-03T22:00:00.000Z'), 'value preserved exactly');

console.log('\ncamelCase durationSeconds must NOT be dropped:');
ok(n1.duration_seconds === 2700, `duration_seconds = ${n1.duration_seconds} (was undefined before)`);

console.log('\na Date-based producer must keep working unchanged:');
const dateGap = { start: new Date('2026-10-03T22:00:00.000Z'), end: new Date('2026-10-03T22:45:00.000Z'), duration_seconds: 2700 };
const [n2] = normalise([dateGap]);
ok(n2.start instanceof Date && n2.duration_seconds === 2700, 'Date + duration_seconds preserved');

console.log('\nneither key -> derive from the span, never leave it undefined:');
const [n3] = normalise([{ start: '2026-10-03T22:00:00.000Z', end: '2026-10-03T22:45:00.000Z' }]);
ok(n3.duration_seconds === 45 * 60, `derived ${n3.duration_seconds}s from the span`);

console.log('\nunparseable input is dropped, not rendered as a broken gap:');
ok(normalise([{ start: 'not-a-date', end: 'also-not', durationSeconds: 5 }]).length === 0, 'garbage dropped');

console.log('\na mixed batch keeps the good gaps (one bad producer must not lose the night):');
const mixed = normalise([
  { start: '2026-10-03T22:00:00.000Z', end: '2026-10-03T22:45:00.000Z', durationSeconds: 2700 },
  { start: 'nope', end: 'nope' },
  { start: '2026-10-04T06:15:00.000Z', end: '2026-10-04T07:00:00.000Z', durationSeconds: 2700 },
]);
ok(mixed.length === 2, `kept ${mixed.length} of 3`);
ok(mixed.every(m => m.start instanceof Date && m.duration_seconds === 2700), 'both usable gaps fully normalised');

console.log('\nempty input must not throw:');
ok(normalise([]).length === 0, 'empty array -> empty result');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
