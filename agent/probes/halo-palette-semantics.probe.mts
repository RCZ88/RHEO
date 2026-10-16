/**
 * HALO — PALETTE SEMANTICS PROBE. RESULT.md §5.2.
 *
 * Two defects lived here:
 *
 * 1. The dictation surface wore `--color-clay-400` (#e8866b, orange), borrowed from the main
 *    app, inside a surface whose token file declares `--halo-accent` as "the only accent — live,
 *    recording, active". `HALO_STATES.html` board 1 draws the dictation mic with
 *    `color:var(--signal)`, and in that file `--signal` IS the same green. So the orange was
 *    never in the design; it was invented during transcription, and it is why speech-to-text
 *    "didn't fit the style".
 *
 * 2. `AmbientCard` mapped each activity KIND to a hue (sky / sage / amber / clay). A kind is
 *    identity; the project's own rule is "on a data surface colour means TIER, never identity",
 *    so hue was communicating the activity's category rather than anything about its value.
 */

import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string, got?: unknown): void => {
  if (!cond) fail++;
  else pass++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}${got !== undefined ? ` -> ${JSON.stringify(got)}` : ''}`);
};

const css = readFileSync('src/features/halo/halo.css', 'utf8');
const card = readFileSync('src/features/halo/AmbientCard.tsx', 'utf8');
const dict = readFileSync('src/features/halo/DictationActivity.tsx', 'utf8');

const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n--- the island carries no borrowed app palette ---');
// Match only rendered code, never comments — the fix documents the removed hue by name.
const islands = code(readFileSync('src/features/halo/CompactPill.tsx', 'utf8'));
const cardCode = code(card);
const dictCode = code(dict);
const cssCode = code(css);
for (const [name, src] of [
  ['CompactPill', islands],
  ['AmbientCard', cardCode],
  ['DictationActivity', dictCode],
  ['halo.css', cssCode],
] as const) {
  ok(
    !/var\(--color-(clay|sky|sage|amber)/.test(src),
    `${name} references no app-palette hue`,
    (src.match(/var\(--color-(?:clay|sky|sage|amber)-?\d*\)/g) ?? []).slice(0, 3),
  );
}

console.log('\n--- clay is gone as a STATUS colour ---');
ok(!/clay/.test(cardCode), 'AmbientCard has no clay entry');
ok(!/clayDeep/.test(cardCode), 'AmbientCard has no clayDeep entry');
ok(!/color-clay/.test(dictCode), 'DictationActivity has no clay reference');

console.log('\n--- colour encodes STATUS, not identity ---');
ok(/STATUS_OF|statusColour/.test(cardCode), 'a status resolver exists');
ok(!/DOMAIN_CLASS/.test(cardCode), 'the identity-hue map is deleted, not renamed');
ok(!/DOMAIN_OF/.test(cardCode), 'the kind->hue table is deleted');
// Every resolved hue must be one of the three declared statuses.
const hues = [...cardCode.matchAll(/STATUS_COLOUR = \{([\s\S]*?)\}/g)];
ok(hues.length === 1, 'exactly one status palette');
ok(
  /accent: 'var\(--halo-accent\)'/.test(cardCode) && /signal: 'var\(--halo-signal\)'/.test(cardCode),
  'the only two signal hues are the ones halo.css already declares',
);

console.log('\n--- the dead token is gone ---');
ok(!/--halo-focus\s*:/.test(cssCode), '--halo-focus was dead and is removed');

console.log('\n--- both themes declare a readable warning hue ---');
const darkSignal = cssCode.match(/--halo-signal:\s*(#[0-9a-f]{6})/i)?.[1];
ok(Boolean(darkSignal), 'dark declares --halo-signal explicitly', darkSignal);
const lightBlock = cssCode.slice(cssCode.indexOf('html.light'));
const lightSignal = lightBlock.match(/--halo-signal:\s*(#[0-9a-f]{6})/i)?.[1];
ok(Boolean(lightSignal), 'light declares its OWN --halo-signal (not inherited from dark)', lightSignal);
ok(
  darkSignal !== lightSignal,
  'the two themes use different warning hues, so light is not inheriting a dark-theme amber',
  { dark: darkSignal, light: lightSignal },
);

console.log('\n--- recording wears the island accent ---');
ok(
  /var\(--halo-accent\)/.test(dictCode),
  'the live waveform / mic uses --halo-accent, which halo.css calls the recording accent',
);
/* The TOKEN is asserted against the comment-stripped source; the DOCUMENTATION is asserted
   against the raw file. Checking a comment in comment-stripped source can only ever fail. */
ok(/--halo-accent:/.test(cssCode), '--halo-accent is declared');
ok(
  /--halo-accent:[^\n]*only accent[^\n]*recording/.test(css),
  'halo.css still documents --halo-accent as the only accent (live, recording, active)',
);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);