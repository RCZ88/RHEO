/**
 * Probe: does adding a split slot preserve the LOCKED durations AND the total?
 *
 * Mirrors `redistribute` + `addSegment` from src/components/AfkPromptModal.tsx
 * verbatim (lines 162-226) so the numbers come from the shipped logic, not a
 * paraphrase of it.
 */

const minPerSegment = 60; // 1 minute, as in the component

interface Segment {
  id: number;
  activityId: string | null;
  durationSeconds: number;
  locked?: boolean;
}

// ── copied verbatim from AfkPromptModal.tsx:162-191 ────────────────────────────
function redistribute(totalDurationSeconds: number, count: number, current: Segment[]): number[] {
  if (count === 0) return [];
  const lockedDurations = current.filter(s => s.locked).map(s => s.durationSeconds);
  const unlockedCount = count - lockedDurations.length;
  if (unlockedCount <= 0) {
    return [...lockedDurations, ...Array.from({ length: count - lockedDurations.length }, () => 0)];
  }

  let lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
  let unlockedTotal = totalDurationSeconds - lockedTotal;
  if (unlockedTotal < unlockedCount * minPerSegment) {
    let deficit = unlockedCount * minPerSegment - unlockedTotal;
    for (let i = lockedDurations.length - 1; i >= 0 && deficit > 0; i--) {
      const take = Math.min(deficit, Math.max(0, lockedDurations[i] - minPerSegment));
      lockedDurations[i] -= take;
      deficit -= take;
    }
    lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
    unlockedTotal = totalDurationSeconds - lockedTotal;
  }

  const per = Math.floor(unlockedTotal / unlockedCount);
  const rem = unlockedTotal - per * unlockedCount;
  const shares = Array.from({ length: unlockedCount }, (_, i) => per + (i === unlockedCount - 1 ? rem : 0));

  const out: number[] = [];
  let k = 0;
  for (const seg of current) out.push(seg.locked ? lockedDurations.shift()! : shares[k++]);
  return out;
}

// ── copied verbatim from AfkPromptModal.tsx:217-226 ────────────────────────────
let segCounter = { current: 1 };
function addSegment(prev: Segment[], totalDurationSeconds: number): Segment[] {
  segCounter.current += 1;
  const next = [...prev, { id: segCounter.current, activityId: null, durationSeconds: 0 }];
  const shares = redistribute(totalDurationSeconds, next.length, prev);
  return next.map((seg, i) => ({ ...seg, durationSeconds: shares[i] ?? 0 }));
}

// ── the same, with the proposed fix ────────────────────────────────────────────
function redistributeFixed(totalDurationSeconds: number, count: number, current: Segment[]): number[] | null {
  if (count === 0) return [];
  const lockedDurations = current.filter(s => s.locked).map(s => s.durationSeconds);
  const unlockedCount = count - lockedDurations.length;
  if (unlockedCount <= 0) {
    return [...lockedDurations, ...Array.from({ length: count - lockedDurations.length }, () => 0)];
  }
  const lockedTotal = lockedDurations.reduce((s, d) => s + d, 0);
  const unlockedTotal = totalDurationSeconds - lockedTotal;
  // Refuse when honouring the pins would starve an unlocked slot.
  if (unlockedTotal < unlockedCount * minPerSegment) return null;
  const per = Math.floor(unlockedTotal / unlockedCount);
  const rem = unlockedTotal - per * unlockedCount;
  const shares = Array.from({ length: unlockedCount }, (_, i) => per + (i === unlockedCount - 1 ? rem : 0));
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const seg = current[i];
    out.push(seg?.locked ? lockedDurations.shift()! : shares[k++]);
  }
  return out;
}
function addSegmentFixed(prev: Segment[], totalDurationSeconds: number): Segment[] {
  const next = [...prev, { id: ++segCounter.current, activityId: null, durationSeconds: 0 }];
  const shares = redistributeFixed(totalDurationSeconds, next.length, prev);
  if (!shares) return prev;  // refused — nothing added, nothing moved
  return next.map((seg, i) => ({ ...seg, durationSeconds: shares[i] ?? 0 }));
}

const mins = (s: number) => Math.round(s / 60);
const show = (segs: Segment[]) =>
  segs.map(s => `${mins(s.durationSeconds)}m${s.locked ? '(locked)' : ''}`).join(' + ');

// ── scenarios ─────────────────────────────────────────────────────────────────
type Scenario = { name: string; total: number; start: Segment[] };
const scenarios: Scenario[] = [
  {
    name: 'no locks: 60m split once',
    total: 3600,
    start: [{ id: 1, activityId: 'a', durationSeconds: 3600 }],
  },
  {
    name: 'LOCKED first slot 30m/30m, then split again',
    total: 3600,
    start: [
      { id: 1, activityId: 'a', durationSeconds: 1800, locked: true },
      { id: 2, activityId: 'b', durationSeconds: 1800 },
    ],
  },
  {
    name: 'LOCKED both slots 20m/40m, then split again',
    total: 3600,
    start: [
      { id: 1, activityId: 'a', durationSeconds: 1200, locked: true },
      { id: 2, activityId: 'b', durationSeconds: 2400, locked: true },
    ],
  },
  {
    name: '45m gap, no locks, split twice',
    total: 2700,
    start: [{ id: 1, activityId: 'a', durationSeconds: 2700 }],
  },
];

let failures = 0;
for (const sc of scenarios) {
  let cur = sc.start;
  const rounds = sc.name.includes('LOCKED first') || sc.name.includes('LOCKED both') ? 1 : 2;

  console.log(`\n${sc.name}   (total ${mins(sc.total)}m)`);
  console.log(`  start           : ${show(cur)}`);

  for (let r = 0; r < rounds; r++) {
    const before = [...cur];
    cur = addSegment(cur, sc.total);
    const afterSum = cur.reduce((s, x) => s + x.durationSeconds, 0);
    const newSeg = cur[cur.length - 1];
    console.log(`  after split #${r + 1}  : ${show(cur)}   sum=${mins(afterSum)}m`);

    // the two things the user actually asked for
    const lockedHeld = before
      .filter(b => b.locked)
      .every(b => cur.find(c => c.id === b.id)?.durationSeconds === b.durationSeconds);
    const sumHeld = afterSum === sc.total;
    const newSegLegal = newSeg.durationSeconds >= minPerSegment;

    if (!lockedHeld) { console.log(`    FAIL locked slot changed`); failures++; }
    if (!sumHeld) {
      console.log(`    FAIL total drifted by ${mins(afterSum - sc.total)}m  (${mins(sc.total)}m -> ${mins(afterSum)}m) — time is LOST`);
      failures++;
    }
    if (!newSegLegal) {
      console.log(`    FAIL new slot got ${newSeg.durationSeconds}s (< ${minPerSegment}s minimum)`);
      failures++;
    }
  }
}

console.log(`\n=== CURRENT CODE: ${failures} failure(s) ===`);

console.log(`\n########## SAME SCENARIOS WITH THE FIX ##########`);
let fixedFailures = 0;
for (const sc of scenarios) {
  let cur = sc.start;
  const rounds = sc.name.includes('LOCKED first') || sc.name.includes('LOCKED both') ? 1 : 2;
  console.log(`\n${sc.name}   (total ${mins(sc.total)}m)`);
  console.log(`  start           : ${show(cur)}`);
  for (let r = 0; r < rounds; r++) {
    const before = [...cur];
    cur = addSegmentFixed(cur, sc.total);
    const afterSum = cur.reduce((s, x) => s + x.durationSeconds, 0);
    const refused = cur.length === before.length;
    console.log(`  after split #${r + 1}  : ${show(cur)}   sum=${mins(afterSum)}m${refused ? '   [REFUSED]' : ''}`);
    const lockedHeld = before
      .filter(b => b.locked)
      .every(b => cur.find(c => c.id === b.id)?.durationSeconds === b.durationSeconds);
    if (!lockedHeld) { console.log(`    FAIL locked slot changed`); fixedFailures++; }
    if (afterSum !== sc.total) {
      console.log(`    FAIL total drifted by ${mins(afterSum - sc.total)}m`);
      fixedFailures++;
    }
    if (!refused && cur[cur.length - 1].durationSeconds < minPerSegment) {
      console.log(`    FAIL new slot below minimum`);
      fixedFailures++;
    }
    if (refused && before.some(b => b.locked)) {
      console.log(`    ok refused, all pins intact`);
    }
  }
}
console.log(`\n=== FIXED CODE: ${fixedFailures} failure(s) ===`);
process.exit(failures > 0 && fixedFailures === 0 ? 0 : 1);