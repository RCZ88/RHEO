import {
  AFK_DEFER_TO_SLEEP_MINUTES,
  MIN_SLEEP_OVERLAP_MINUTES,
  classifyGap,
  describeSleepWindow,
  hourInSleepWindow,
  sleepWindowOverlapMinutes,
} from '../../src/shared/sleepWindow';

const START = 22; // 22:00
const END = 7; // 07:00

function at(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

const rows: { label: string; from: number; to: number }[] = [
  { label: 'coffee break 10:15->11:00 (was a FALSE SLEEP before)', from: at(2026, 10, 3, 10, 15), to: at(2026, 10, 3, 11, 0) },
  { label: 'lunch 12:30->13:30', from: at(2026, 10, 3, 12, 30), to: at(2026, 10, 3, 13, 30) },
  { label: 'pre-bed 20:00->21:30 (touching only, 0min overlap)', from: at(2026, 10, 3, 20, 0), to: at(2026, 10, 3, 21, 30) },
  { label: 'pre-bed 20:00->22:30 (30min real overlap)', from: at(2026, 10, 3, 20, 0), to: at(2026, 10, 3, 22, 30) },
  { label: 'full night 23:00->07:30', from: at(2026, 10, 3, 23, 0), to: at(2026, 10, 4, 7, 30) },
  { label: 'overnight spanning midnight 22:30->09:00', from: at(2026, 10, 3, 22, 30), to: at(2026, 10, 4, 9, 0) },
  { label: 'early morning only 02:00->06:00', from: at(2026, 10, 4, 2, 0), to: at(2026, 10, 4, 6, 0) },
  { label: 'nap 14:00->14:30', from: at(2026, 10, 3, 14, 0), to: at(2026, 10, 3, 14, 30) },
  { label: '23:30 bathroom 20min (AFK bar 10min)', from: at(2026, 10, 3, 23, 30), to: at(2026, 10, 4, 0, 0) },
];

console.log(`window = ${describeSleepWindow(START, END)}\n`);
console.log(
  'gap'.padEnd(52) + 'gapMin'.padStart(8) + 'overlap'.padStart(9) + '  verdict(45m)',
);
console.log('-'.repeat(84));

let pass = 0;
let fail = 0;
const expect: Record<string, string> = {
  'coffee break 10:15->11:00 (was a FALSE SLEEP before)': 'afk',
  'lunch 12:30->13:30': 'afk',
  'pre-bed 20:00->21:30 (touching only, 0min overlap)': 'afk',
  'pre-bed 20:00->22:30 (30min real overlap)': 'afk',
  'full night 23:00->07:30': 'sleep',
  'overnight spanning midnight 22:30->09:00': 'sleep',
  'early morning only 02:00->06:00': 'sleep',
  'nap 14:00->14:30': 'afk',
  '23:30 bathroom 20min (AFK bar 10min)': 'afk',
};

for (const r of rows) {
  const c = classifyGap(START, END, r.from, r.to);
  const want = expect[r.label];
  const ok = c.verdict === want;
  ok ? pass++ : fail++;
  console.log(
    r.label.padEnd(52) +
      String(c.gapMinutes).padStart(8) +
      String(c.overlapMinutes).padStart(9) +
      `  ${c.verdict.padEnd(6)} ${ok ? 'PASS' : `FAIL want=${want}`}`,
  );
}

console.log('\n--- hour boundaries for 22 -> 7 (end is EXCLUSIVE) ---');
let boundaryOk = true;
for (const h of [0, 6, 7, 8, 12, 21, 22, 23]) {
  const inWin = hourInSleepWindow(h, START, END);
  const want = h >= 22 || h < 7;
  if (inWin !== want) boundaryOk = false;
  console.log(`  ${String(h).padStart(2, '0')}:00 in-window=${inWin} expect=${want} ${inWin === want ? 'ok' : 'MISMATCH'}`);
}

console.log('\n--- degenerate windows ---');
console.log(`  start===end (0->0) overlap of a 8h gap = ${sleepWindowOverlapMinutes(0, 0, at(2026,10,4,0), at(2026,10,4,8))} (must be 0)`);
console.log(`  disabled-by-zero-length 22->22 overnight = ${classifyGap(22, 22, at(2026,10,3,22), at(2026,10,4,7)).verdict} (must be afk)`);
console.log(`  zero-length gap = ${classifyGap(START, END, 1000, 1000).overlapMinutes} (must be 0)`);
console.log(`  inverted range end<start, 3h gap inside = ${sleepWindowOverlapMinutes(START, END, at(2026,10,4,0), at(2026,10,4,3))} (must be 180)`);

console.log(`\nRESULT: ${fail === 0 && boundaryOk ? 'ALL PASS' : 'FAILURES'}  rows ${pass} pass / ${fail} fail`);

// The AFK prompt uses a much LOWER bar than the sleep popup, deliberately. A
// 12-minute absence at 23:30 is not sleep, but it must not be asked about
// either. Verify the two bars actually diverge.
console.log('\n--- the two bars must diverge (this is the whole point) ---');
const bathroom = { from: at(2026, 10, 3, 23, 30), to: at(2026, 10, 4, 0, 0) }; // 30min at 23:30
const lunch = { from: at(2026, 10, 3, 12, 30), to: at(2026, 10, 3, 13, 30) };
const cases: [string, { from: number; to: number }, boolean, boolean][] = [
  ['23:30 bathroom 30min', bathroom, false, true],
  ['lunch 12:30 60min', lunch, false, false],
];
let barsOk = true;
for (const [label, g, wantSleep, wantDefer] of cases) {
  const sleepBar = classifyGap(START, END, g.from, g.to, MIN_SLEEP_OVERLAP_MINUTES).verdict === 'sleep';
  const afkBar = classifyGap(START, END, g.from, g.to, AFK_DEFER_TO_SLEEP_MINUTES).verdict === 'sleep';
  const ok = sleepBar === wantSleep && afkBar === wantDefer;
  if (!ok) barsOk = false;
  console.log(
    `  ${label.padEnd(24)} sleepPopup=${String(sleepBar).padEnd(5)}(want ${wantSleep})  afkStandsDown=${String(afkBar).padEnd(5)}(want ${wantDefer})  ${ok ? 'PASS' : 'FAIL'}`,
  );
}

process.exit(fail === 0 && boundaryOk && barsOk ? 0 : 1);
