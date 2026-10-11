import { scaleSegmentsToGap } from '../../src/lib/external/gaps';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const sum = (s: { minutes: number }[]) => s.reduce((a, b) => a + b.minutes, 0);

console.log('bulk fill must preserve SHAPE and hit the target EXACTLY:');
// 45m gap answered as 30 + 15, then scaled onto a 90m gap -> 60 + 30
const base = [
  { id: 'a', activityId: '1', minutes: 30 },
  { id: 'b', activityId: '2', minutes: 15 },
];
for (const targetMin of [45, 90, 180, 20, 7]) {
  const out = scaleSegmentsToGap(base, targetMin * 60);
  const total = sum(out);
  console.log(`  ${String(targetMin).padStart(3)}m target -> ${out.map(s => s.minutes + 'm').join(' + ')} = ${total}m`);
  ok(total === targetMin, `${targetMin}m target filled exactly (got ${total}m)`);
  ok(out.length === base.length, `${targetMin}m keeps both segments`);
}

console.log('\nproportions:');
const up = scaleSegmentsToGap(base, 90 * 60);
ok(up[0].minutes === 60 && up[1].minutes === 30, `30:15 scaled 2x -> ${up[0].minutes}:${up[1].minutes} (want 60:30)`);
const down = scaleSegmentsToGap(base, 22 * 60);
ok(down[0].minutes > down[1].minutes, `scaled down keeps the larger share first (${down[0].minutes}:${down[1].minutes})`);

console.log('\ndegenerate input must not produce holes:');
const one = scaleSegmentsToGap([{ id: 'a', activityId: '1', minutes: 30 }], 90 * 60);
ok(one.length === 1 && one[0].minutes === 90, `single segment absorbs the whole gap (${one[0]?.minutes}m)`);
const none = scaleSegmentsToGap([{ id: 'a', activityId: null, minutes: 30 }], 90 * 60);
ok(none.length === 0, 'unassigned segments are dropped');
const tiny = scaleSegmentsToGap(
  [{ id: 'a', activityId: '1', minutes: 20 }, { id: 'b', activityId: '2', minutes: 20 }, { id: 'c', activityId: '3', minutes: 20 }],
  5 * 60,
);
ok(sum(tiny) === 5, `3 segments into a 5m gap still totals 5 (${tiny.map(s => s.minutes).join('+')})`);
ok(tiny.every(s => s.minutes >= 1), 'no zero-length segment is emitted');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
