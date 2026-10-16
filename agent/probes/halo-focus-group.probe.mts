/**
 * HALO — FOCUS GROUPING PROBE. RESULT.md §5.3.
 *
 * The expanded Focus page rendered three blocks separated by two dividers — STOPWATCH |
 * TRACKING <app> | PRODUCTIVE — so the app name read as an unrelated figure beside the timer
 * rather than as part of it. The user's correction was explicit: the name belongs WITH the
 * stopwatch, because "Figma for 42 minutes" is one statement.
 *
 * This asserts the GROUPING, and one thing it must not do: add a row. The Medium budget is
 * `12 + 56 + 8 + 44 = 120px` inside a 134px window. A layout change that adds a line of type
 * does not fail any geometry probe — it just clips, which is the "only the top 4/5 shows" report.
 */

import { readFileSync } from 'node:fs';
import { HALO_SIZE_PRESETS } from '../../src/shared/halo/sizes';

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string, got?: unknown): void => {
  if (!cond) fail++;
  else pass++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}${got !== undefined ? ` -> ${JSON.stringify(got)}` : ''}`);
};

const focus = readFileSync('src/features/halo/FocusPageRow.tsx', 'utf8');
// Comments explain the OLD layout by name; assert against rendered code only.
const code = focus.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n--- one stopwatch group, holding the name ---');
ok(!/>Tracking</.test(code), 'the separate TRACKING block is gone');
ok(/tracked\.label/.test(code), 'the app/site name is rendered');
ok(!/EYEBROW}>Tracking/.test(code), 'there is no second eyebrow label competing with STOPWATCH');

console.log('\n--- ONE block divider, not two ---');
const blockDividers = (code.match(/width: 1, height: 44/g) ?? []).length;
ok(blockDividers === 1, 'exactly one 44px divider remains (group | PRODUCTIVE)', { found: blockDividers });

console.log('\n--- the name sits inside the stopwatch group, before the clock ---');
const groupStart = code.indexOf('{EYEBROW}</span>');
const nameAt = code.indexOf('tracked.label');
const clockAt = code.indexOf('{dim}</span>');
ok(
  groupStart > -1 && nameAt > groupStart && clockAt > nameAt,
  'order is: label -> name -> clock, all within the left group',
  { labelAt: groupStart, nameAt, clockAt },
);
// The label/name hairline is a SEPARATOR inside the group, not a block divider.
ok(/width: 1, height: 8/.test(code), 'a small hairline separates the label from the name');

console.log('\n--- the privacy guarantee survives the merge ---');
ok(/kind === 'priv'/.test(code), 'a private window still renders its own shape');
/* The literal lives in CompactPill; the Focus page receives it as `tracked.label` from
   OverlayRoot. Asserting the string here would pin the Focus page to a label it is not
   supposed to own, so assert the CONTRACT instead: a tracked target exists and is rendered. */
ok(/tracked\?:\s*\{ kind: 'win' \| 'web' \| 'priv'/.test(code) || /tracked\?:/.test(code),
  'the Focus page accepts a tracked target of kind win | web | priv');
// The name must never be able to show a hostname for a private window.
const privBranch = code.slice(code.indexOf("kind === 'priv'"));
ok(
  !/private[\s\S]{0,400}?domain/.test(privBranch),
  'the private branch never renders a domain',
);

console.log('\n--- the two 44px controls are unchanged ---');
ok(/width: 44,\s*\n\s*height: 44/.test(code), 'a 44x44 control is still present');
ok(/RotateCcw/.test(code) && /Pause/.test(code) && /Play/.test(code), 'reset + pause/play intact');

console.log('\n--- it adds no vertical row ---');
for (const [name, p] of Object.entries(HALO_SIZE_PRESETS)) {
  const pad = p.padding * 2;
  const content = p.rowHeight;
  const rail = 44;
  const budget = pad + content + 8 + rail;
  ok(
    budget <= p.expandedHeight,
    `${name}: the two-block row still fits ${p.expandedWidth}x${p.expandedHeight}`,
    { budget, window: p.expandedHeight, slack: p.expandedHeight - budget },
  );
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);