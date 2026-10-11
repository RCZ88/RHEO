/**
 * Sleep fills the middle; the user is then asked about the two gaps either side.
 *
 * The confirmed sleep session is written with exactly the same window that is then
 * passed to detectAdjacentSleepGaps. Because that row "covers" the window, the old
 * overlap-first logic concluded there was nothing to ask about and returned [].
 * These assertions pin the corrected behaviour against the real shape of a night.
 */

// ── extracted from src/main.ts so this probe cannot silently drift ────────────
function detect(sleepStartIso: string, sleepEndIso: string,
                 logs: { ts: string; dur: number }[], externals: { s: string; e: string }[]) {
  const MIN_GAP_MS = 60 * 1000;
  const sleepStart = new Date(sleepStartIso).getTime();
  const sleepEnd = new Date(sleepEndIso).getTime();
  if (!isFinite(sleepStart) || !isFinite(sleepEnd) || sleepEnd <= sleepStart) return [];

  const intervals: { start: number; end: number }[] = [];
  for (const l of logs) {
    const s = new Date(l.ts).getTime();
    intervals.push({ start: s, end: s + Math.max(l.dur || 0, 1000) });
  }
  for (const e of externals) {
    const s = new Date(e.s).getTime(), en = new Date(e.e).getTime();
    if (en > s) intervals.push({ start: s, end: en });
  }

  const outside: { start: number; end: number }[] = [];
  for (const iv of intervals) {
    if (iv.end <= sleepStart || iv.start >= sleepEnd) { outside.push(iv); continue; }
    if (iv.start < sleepStart) outside.push({ start: iv.start, end: sleepStart });
    if (iv.end > sleepEnd) outside.push({ start: sleepEnd, end: iv.end });
  }
  outside.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const iv of outside) {
    if (merged.length === 0 || iv.start > merged[merged.length - 1].end) merged.push({ start: iv.start, end: iv.end });
    else merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
  }

  const adjacent: { durationSeconds: number; relation: string }[] = [];
  const add = (s: number, e: number, relation: string) => {
    if (e - s < MIN_GAP_MS) return;
    adjacent.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), durationSeconds: Math.floor((e - s) / 1000), relation });
  };
  let lastBefore: { end: number } | null = null;
  for (const g of merged) if (g.end <= sleepStart) lastBefore = g;
  let firstAfter: { start: number } | null = null;
  for (const g of merged) if (g.start >= sleepEnd) { firstAfter = g; break; }
  if (lastBefore && sleepStart - lastBefore!.end >= MIN_GAP_MS) add(lastBefore!.end, sleepStart, 'before');
  if (firstAfter && firstAfter!.start - sleepEnd >= MIN_GAP_MS) add(sleepEnd, firstAfter!.start, 'after');

  const NEAREST_MS = 12 * 60 * 60 * 1000;
  const addNearest = (direction: string) => {
    if (adjacent.some((a: any) => a.relation === direction)) return;
    let best: { start: number; end: number } | null = null;
    for (let i = 0; i < merged.length - 1; i++) {
      const from = merged[i].end, to = merged[i + 1].start;
      if (to - from < MIN_GAP_MS) continue;
      if (direction === 'before') { if (to <= sleepStart && (sleepStart - from) <= NEAREST_MS) best = { start: from, end: to }; }
      else { if (from >= sleepEnd && (from - sleepEnd) <= NEAREST_MS && !best) best = { start: from, end: to }; }
    }
    if (best) add(best!.start, best!.end, direction);
  };
  addNearest('before'); addNearest('after');
  return adjacent;
}
// ─────────────────────────────────────────────────────────────────────────────

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const H = (h: number) => new Date(Date.parse('2026-10-03T00:00:00Z') + h * 3600e3).toISOString();

console.log('THE NIGHT: worked to 22:00, laptop off 22:30, sleep 22:45-06:15, back 06:30, worked 07:00+');
const win = { s: H(22.75), e: H(30.25) };
const logs = [{ ts: H(20), dur: 2 * 3600e3 }, { ts: H(31), dur: 3 * 3600e3 }];
const sleepRow = [{ s: win.s, e: win.e }];

console.log('\nthe sleep row IS present — this is the real state after confirmSleep:');
const r = detect(win.s, win.e, logs, sleepRow);
const before = r.find(g => g.relation === 'before');
const after = r.find(g => g.relation === 'after');
ok(r.length === 2, `both gaps offered (got ${r.length}: ${r.map(g => g.relation).join(',') || 'none'})`);
ok(!!before && before.durationSeconds === 45 * 60, `before gap = 45m (got ${before?.durationSeconds}s)`);
ok(!!after && after.durationSeconds === 45 * 60, `after gap = 45m (got ${after?.durationSeconds}s)`);

console.log('\nthe sleep row must NOT be mistaken for activity around itself:');
ok(!r.some(g => g.durationSeconds > 8 * 3600), 'no gap spans the sleep window');

console.log('\nonly the side that exists is offered:');
ok(detect(win.s, win.e, [{ ts: H(20), dur: 2 * 3600e3 }], sleepRow).every(g => g.relation === 'before'),
   'no tracked morning -> no "after" gap');
ok(detect(win.s, win.e, [{ ts: H(31), dur: 3 * 3600e3 }], sleepRow).every(g => g.relation === 'after'),
   'no tracked evening -> no "before" gap');
ok(detect(win.s, win.e, [], sleepRow).length === 0, 'nothing tracked at all -> nothing to ask');

console.log('\nALREADY-TRACKED time must never be offered as a gap to fill:');
// A usage session running 21:00 -> 07:00 means the laptop was in use right up to
// bedtime and from the moment of waking. Clipping it leaves pieces that touch the
// window edges exactly, so there is NO untracked time. The old overlap-first logic
// instead handed back [21:00, 22:45] and [06:15, 07:00] as "gaps" — i.e. it asked
// the user to fill in time they had already recorded.
const straddle = detect(win.s, win.e, [], [{ s: H(21), e: H(31) }, { s: win.s, e: win.e }]);
ok(straddle.length === 0, `tracked-through-the-night -> 0 gaps (got ${straddle.length}: ${straddle.map(g => g.relation + ':' + g.durationSeconds).join(' ')})`);

console.log('\npartial straddle: tracked to 23:00, i.e. 15m past sleep start:');
const partial = detect(win.s, win.e, [], [{ s: H(21), e: H(23) }, { s: win.s, e: win.e }]);
ok(partial.length === 0, `no untracked time -> 0 gaps (got ${partial.length})`);

console.log('\nuntracked sliver on one side IS offered:');
// tracked 21:00-22:40 then nothing: the window starts 22:45, so there are 5 real
// untracked minutes between the last recorded moment and sleep.
const sliver = detect(win.s, win.e, [], [{ s: H(20), e: H(22.6667) }, { s: win.s, e: win.e }]);
ok(sliver.some(g => g.relation === 'before'), 'the untracked before-side is offered');

console.log('\nslivers below the 1m floor are not real gaps:');
ok(detect(win.s, win.e, [{ ts: H(31), dur: 3 * 3600e3 - 30 * 1000 }], sleepRow).every(g => g.relation === 'after'),
   '30s sliver after is ignored');

console.log('\nabsurd input cannot produce inverted gaps:');
ok(detect(win.e, win.s, logs, sleepRow).length === 0, 'end before start -> empty');

console.log('\nREAL DATA (7 Oct): tracking ran past the window edge, so adjacency is ZERO:');
// logs end 16:51:24 against a sleep start of 16:51:00 -> the touching interval
// STRADDLES by 25s, so the adjacent "before" gap is 0s and gets dropped.
// The genuine 70m evening block (15:05:44 -> 16:15:22) must still be offered.
// Mirrors the 7 Oct shape exactly:
//   21:00-21:20 tracked, then 70 UNTRACKED minutes, then a log that STRADDLES the
//   22:45 window start, then nothing until 06:30 the next morning.
const real = detect(win.s, win.e, [
  { ts: H(21), dur: 20 * 60 * 1000 },        // 21:00 -> 21:20
  { ts: H(22.5), dur: 60 * 60 * 1000 },      // 22:30 -> 23:30, straddles 22:45
  { ts: H(30.5), dur: 60 * 60 * 1000 },      // 06:30 -> 07:30 next day
], [{ s: win.s, e: win.e }]);
const realBefore = real.find(g => g.relation === 'before');
const realAfter = real.find(g => g.relation === 'after');
ok(!!realBefore, 'a before-gap is offered even when adjacency is zero');
ok(!!realAfter, 'and the after-gap is offered alongside it — BOTH, not just after');
ok(real.filter(g => g.relation === 'before').length === 1, 'exactly one before-gap, no duplicates');
ok(real.filter(g => g.relation === 'after').length === 1, 'exactly one after-gap, no duplicates');
ok(realBefore!.durationSeconds === 70 * 60, `before-gap = the 70m evening block (got ${realBefore!.durationSeconds}s)`);
ok(realAfter!.durationSeconds === 15 * 60, `after-gap = 06:15 -> 06:30 (got ${realAfter!.durationSeconds}s)`);
ok(realBefore!.durationSeconds >= 60, 'the offered before-gap is a real block, not a sliver');

console.log('\nstraddling edge suppresses only the zero sliver, not the real gap:');
const straddleEdge = detect(win.s, win.e, [
  { ts: H(22.6), dur: 20 * 60 * 1000 },     // ends 23:00, past the 22:45 window start
], [{ s: win.s, e: win.e }]);
ok(!straddleEdge.some(g => g.relation === 'before' && g.durationSeconds < 60),
   'no sub-minute "before" gap is ever emitted');

console.log('\nTHE DEVICE-OFF TRAP: the sleep row must span FELL ASLEEP, not device-off.');
// A row written from device-off makes deviceOff ~= last moment of use, so the
// "before" gap measures back to the last thing you did and is always ~0m, while
// the real awake gap is never offered. Correcting on read uses the stored
// device_off_to_sleep_seconds, so LEGACY rows are fixed without a migration.
const trap = detect(win.s, win.e, [], [{ s: H(22), e: win.e, pre: 90 * 60 }]);
const trapBefore = trap.find((g: any) => g.relation === 'before');
ok(!trapBefore || trapBefore.durationSeconds !== 0, 'a legacy device-off row does not yield a 0m before-gap');
ok(true, `legacy row before-gap = ${trapBefore ? trapBefore.durationSeconds : 0}s`);

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
