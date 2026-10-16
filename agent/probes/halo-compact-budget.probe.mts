/**
 * HALO — COMPACT PILL BUDGET PROBE. RESULT.md §5.1.
 *
 * The pill was cut off because the app-name label carried a fixed `max-width: 140px` while the
 * row's real chrome (dot + clock + divider + gaps) took 82-96px, so the content exceeded the
 * pill width at EVERY preset. No existing probe could see it: the other six assert geometry
 * arithmetic, board coverage and window properties, and a flex row that overflows its own box is
 * none of those things.
 *
 * This asserts the ARITHMETIC, which is where the defect actually lived, and it derives its
 * expectations from `sizes.ts` rather than restating them.
 */

import { readFileSync } from 'node:fs';
import {
  COMPACT_PILL_WIDTH,
  remainingCompactWidth,
  stopwatchPillBudget,
  type CompactPreset,
} from '../../src/shared/halo/compactBudget';
import { HALO_SIZE_PRESETS } from '../../src/shared/halo/sizes';

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string, got?: unknown): void => {
  if (!cond) fail++;
  else pass++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}${got !== undefined ? ` -> ${JSON.stringify(got)}` : ''}`);
};

const presetFor: Record<CompactPreset, keyof typeof HALO_SIZE_PRESETS> = {
  small: 'small',
  medium: 'medium',
  large: 'large',
};

console.log('\n--- the duplicated constant must not drift from sizes.ts ---');
for (const p of ['small', 'medium', 'large'] as CompactPreset[]) {
  const declared = COMPACT_PILL_WIDTH[p];
  const real = HALO_SIZE_PRESETS[presetFor[p]].compactWidth;
  ok(
    declared === real,
    `${p}: compactBudget agrees with sizes.ts`,
    { compactBudget: declared, sizes: real },
  );
}

console.log('\n--- RESULT.md §3.2 fixtures: the stopwatch pill budget ---');
// S=100, M=109, L=131 are the measured values the correction was made against.
const FIXTURES: Record<CompactPreset, number> = { small: 100, medium: 109, large: 131 };
for (const p of ['small', 'medium', 'large'] as CompactPreset[]) {
  const got = stopwatchPillBudget(HALO_SIZE_PRESETS[presetFor[p]].fBody, p);
  ok(
    got === FIXTURES[p],
    `${p}: stopwatch pill leaves ${FIXTURES[p]}px for the app name`,
    { got, expected: FIXTURES[p] },
  );
}

console.log('\n--- the name is NEVER given a fixed width again ---');
const pill = readFileSync('src/features/halo/CompactPill.tsx', 'utf8');
const nameBlock = pill.slice(pill.indexOf('const nameStyle'), pill.indexOf('const dotStyle'));
ok(/minWidth: 0/.test(nameBlock), 'the truncating name has min-width: 0 (else ellipsis cannot work)');
ok(/flex: '0 1 auto'/.test(nameBlock), 'the name is flex-shrinkable');
ok(
  !/maxWidth: 140,/.test(nameBlock) || /maxWidth: 140,[\s\S]{0,120}minWidth: 0/.test(nameBlock),
  'the 140px figure, if retained, is an upper bound and not the effective width',
);

console.log('\n--- fixed children are pinned; only the name shrinks ---');
ok(
  /flexShrink: 0/.test(pill),
  'clock / icon / labels are pinned with flexShrink: 0 so they never truncate',
);
const rowBlock = pill.slice(pill.indexOf('const row'), pill.indexOf('const icon'));
ok(/minWidth: 0/.test(rowBlock), 'the row itself is shrinkable');
ok(/overflow: 'hidden'/.test(rowBlock), 'the row clips, so overflow can never escape the pill');

console.log('\n--- every kind routes through the bounded row ---');
const kinds = ['stopwatch', 'stopwatchSite', 'now', 'website', 'private', 'dictation', 'aiUsage', 'hud', 'nextDeadline', 'critical'];
for (const k of kinds) {
  ok(pill.includes(`'${k}'`), `the '${k}' kind is implemented`);
}
const rowUses = (pill.match(/style=\{row\}/g) ?? []).length;
ok(rowUses >= 7, 'the shared bounded row is used by every variant', { uses: rowUses });

console.log('\n--- zero, never negative ---');
ok(
  remainingCompactWidth({
    preset: 'small',
    horizontalPadding: 40,
    fixedChildWidths: [400],
    gaps: [8, 8, 8],
  }) === 0,
  'an impossible row clamps to 0 rather than reporting a negative width',
);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);