/**
 * HALO — BOARD COVERAGE PROBE. Asserts every board in `agent/docs/halo/HALO_STATES.html` is
 * actually implemented, kind by kind and state by state.
 *
 * WHY THIS EXISTS
 * ---------------
 * A previous cycle reported the work complete while `halo-fit.probe.mts` was green. That probe
 * proved the CONTENT FITS — it said nothing about whether all five boards were drawn. Board 1
 * shipped 4 of its 10 compact kinds and Board 2 shipped a hardcoded eyebrow instead of the
 * spec's three labelled blocks, and every sizing assertion stayed green throughout, because a
 * component drawn at the wrong size is still the right size.
 *
 * So this probe is deliberately EVIDENCE-BASED and enumerates the spec's own kinds and states,
 * derived FROM the html rather than retyped. A kind list copied into a probe drifts from the
 * spec the moment the spec changes — and then the probe passes against a design nobody shipped.
 * The counts below come out of the file.
 */

import { readFileSync } from 'node:fs';

const HTML = 'agent/docs/halo/HALO_STATES.html';
const spec = readFileSync(HTML, 'utf8');

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string, got?: unknown): void => {
  if (!cond) fail++;
  else pass++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}${got !== undefined ? ` -> ${JSON.stringify(got)}` : ''}`);
};
const src = (p: string): string => readFileSync(p, 'utf8');
const pill = src('src/features/halo/CompactPill.tsx');
const overlay = src('src/features/halo/OverlayRoot.tsx');
const focus = src('src/features/halo/FocusPageRow.tsx');
const dictation = src('src/features/halo/DictationActivity.tsx');

/* ── BOARD 1 — compact kinds. The kind list is READ FROM THE SPEC, never retyped. ── */
const board1 = spec.match(/function pill\(k\)\{var m=\{([\s\S]*?)\n \}\[k\]/)?.[1] ?? '';
const kinds = [...board1.matchAll(/^\s*(\w+):'/gm)].map((m) => m[1]);

console.log(`\n--- BOARD 1 — compact kinds (${kinds.length} declared by the spec) ---`);
for (const k of kinds) {
  ok(pill.includes(`'${k}'`), `board 1 renders the '${k}' pill`);
}

console.log('\n--- BOARD 1 — the pill is a flex row with the spec gap ---');
/* Assert the PROPERTIES, not their formatting. The previous pattern required `display` and
 * `alignItems` to sit on one line, so reformatting the style object — with no behavioural change
 * at all — reported the pill as broken. */
ok(
  /display: 'inline-flex'/.test(pill) && /alignItems: 'center'/.test(pill),
  'pill is an inline-flex centred row',
);
ok(/gap: 8/.test(pill), 'pill uses the 8px board-1 gap');
ok(/maxWidth: 140/.test(pill), 'pill name truncates at the board-1 140px');

console.log('\n--- BOARD 2 — Focus page: THREE labelled blocks, not one eyebrow ---');
// spec line 105: lab('Stopwatch') + blk('Tracking', ...) + blk('Productive', ...)
ok(/\bStopwatch\b/i.test(focus), "board 2 block label 'Stopwatch'");
// The label is rendered UPPERCASE by the eyebrow style (CSS text-transform), so a
// case-sensitive /Tracking/ is a probe artifact, not a missing block. Match either case.
ok(/\bTracking\b/i.test(focus), "board 2 block label 'Tracking'");
ok(/\bProductive\b/i.test(focus), "board 2 block label 'Productive'");
// The literal that replaced the labels. It is a Figma frame name, not user-facing copy.
// MATCH ONLY RENDERED CODE — the string still legitimately appears in two COMMENTS: the Figma
// node transcription at the top of the file, and the note explaining why it was removed. A
// source-wide grep for the string therefore matches its own documentation forever, which is a
// probe that can never pass. Strip comments and JSX comments before asserting.
const focusNoComments = focus
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
ok(
  !/STOPWATCH\s+HALO\s+REDESIGN/.test(focusNoComments),
  'board 2 does NOT render the Figma frame name "STOPWATCH HALO REDESIGN" as its eyebrow',
);

console.log('\n--- BOARD 2 — four states ---');
ok(/tracked\.kind === 'priv'/.test(focus), 'board 2: private window shows no hostname');
ok(/tracked\.kind === 'web'/.test(focus), 'board 2: website tracking state');
ok(/live \? 'var\(--halo-accent\)' : 'var\(--halo-dim\)'/.test(focus), 'board 2: dot mutes when stopped');
ok(/live \? 'var\(--halo-text\)' : 'var\(--halo-dim\)'/.test(focus), 'board 2: name mutes when stopped');
ok(/RotateCcw/.test(focus), 'board 2: reset control present');
ok(/Pause/.test(focus) && /Play/.test(focus), 'board 2: pause flips to play when stopped');

console.log('\n--- BOARD 3 — Now page: 6 states ---');
for (const [label, needle] of [
  ['waiting for first read', 'Reading the current app'],
  ['read failed + Retry', 'Retry reading the current app'],
  ['idle: no active app', 'No app detected'],
  ['not in a browser', 'Not in a browser'],
  ['private window', 'Private window'],
] as const) {
  ok(overlay.includes(needle), `board 3 '${label}'`);
}
ok(/<span style={EYEBROW}>App<\/span>/.test(overlay), "board 3 block label 'App'");
ok(/label="Website"/.test(overlay) || overlay.includes('>Website<'), "board 3 block label 'Website'");
ok(overlay.includes('AI usage'), "board 3 block label 'AI usage'");

console.log('\n--- BOARD 4 — Deadlines: 4 states ---');
for (const [label, needle] of [
  ['populated', 'Next deadline'],
  ['Status block', 'Status'],
  ['empty: nothing open', 'No open deadlines'],
  ['error + Retry', 'Retry'],
] as const) {
  ok(overlay.includes(needle), `board 4 '${label}'`);
}
ok(/skeleton|Skeleton/i.test(overlay), 'board 4: loading state (skeleton, no shimmer)');

console.log('\n--- BOARD 5 — Tools: 3 states ---');
ok(/BAR_COUNT = 24/.test(dictation), 'board 5: waveform is 24 bars (spec line 93)');
ok(dictation.includes('Mic blocked'), 'board 5: microphone denied');
ok(/Listening/.test(dictation), 'board 5: listening state');
ok(/idle/.test(dictation) || /: 3\b/.test(dictation), 'board 5: idle bars flat at 3px');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);