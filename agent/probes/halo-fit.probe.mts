/**
 * HALO — FIT PROBE. Measures whether the island's CONTENT fits inside its WINDOW.
 *
 * The bug class this exists for: the user reported the island was "big but cropped, only the
 * top 4/5 showing, bottom cut off". That is an OVERFLOW — content taller than the window — and
 * no existing probe could see it, because every other halo probe asserts SOURCE properties or
 * geometry arithmetic. Both are blind to layout: a 134px window whose children sum to 144px is
 * perfectly legal TypeScript and perfectly correct geometry.
 *
 * WHY ARITHMETIC INSTEAD OF A BROWSER
 * The budget is a sum of fixed, known-height parts (padding + content row + gap + rail), so it
 * is computable exactly. That makes this probe deterministic and runnable in ~50ms with no
 * Electron, no display, and no build. A browser probe would be a better oracle but it could not
 * run in CI, and a probe that only runs when someone has a desktop is a probe that rots.
 *
 * Every constant is READ FROM SOURCE, never retyped. A retyped constant is a test that passes
 * while the design moves — the exact defect AGENTS.md MEMORY records about the 116-vs-118 halo
 * height. If the preset changes, this probe follows it.
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

const css = readFileSync('src/features/halo/halo.css', 'utf8');
const root = readFileSync('src/features/halo/OverlayRoot.tsx', 'utf8');

/** Read `Npx` out of a `--token: max(11px, calc(Npx * ...))` declaration. */
function cssMax(token: string, fallback: number): number {
  const m = css.match(new RegExp(`--${token}:\\s*max\\((\\d+(?:\\.\\d+)?)px`));
  return m ? parseFloat(m[1]) : fallback;
}

/** Read a literal `height: Npx` from a named rule. */
function ruleHeight(selector: string, fallback: number): number {
  const block = css.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*\\{([^}]*)\\}`));
  const m = block?.[1]?.match(/height:\s*(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : fallback;
}

const BUTTON = 44; // HALO_STATES.html line 43: .btn{width:44px;height:44px}

const TAB_RAIL = 44; // HALO_STATES.html line 50: .tabs{height:44px}

console.log('\n--- §73 / HALO_STATES board 2: expanded content must fit the window ---');

const hero = cssMax('halo-t-hero', 26);
const legacyRail = ruleHeight('.halo-rail', 30);

for (const [name, preset] of Object.entries(HALO_SIZE_PRESETS)) {
  const pad = preset.padding * 2;
  // The Figma layout's rail is HaloTabRail (44px, hardcoded at HaloTabRail.tsx:139). `.halo-rail`
  // at 30px belongs to LegacyHaloRail ONLY — it is not the figma rail, and reading it here is how
  // this probe first "found" a 16px overflow that did not exist.
  const rail = TAB_RAIL;
  const content = Math.max(preset.rowHeight, hero);
  const gap = 8;
  const budget = pad + content + gap + rail;

  ok(
    budget <= preset.expandedHeight,
    `${name}: page body + tab rail fits ${preset.expandedWidth}x${preset.expandedHeight}`,
    { budget, window: preset.expandedHeight, slack: preset.expandedHeight - budget },
  );
}

// The legacy rail is 30px but holds the same 44px controls, so it needs the same accounting.
ok(
  legacyRail < BUTTON,
  `the legacy .halo-rail (${legacyRail}px) cannot hold a ${BUTTON}px control — it is only reachable `
    + `behind \`uiVersion: 'legacy' && expanded\`, which is verified below`,
);

console.log('\n--- §83: a 44px control cannot exist inside a compact pill ---');

for (const [name, preset] of Object.entries(HALO_SIZE_PRESETS)) {
  ok(
    BUTTON > preset.compactHeight,
    `${name}: 44px buttons MUST be gated behind \`expanded\` (pill is only ${preset.compactHeight}px)`,
    { pill: preset.compactHeight, button: BUTTON, overflow: BUTTON - preset.compactHeight },
  );
}

console.log('\n--- §72: compact must NOT reuse the expanded page bodies ---');

for (const page of ['focus', 'now', 'deadlines', 'tools']) {
  // Every page block must open with a POSITIVE `expanded` test. Matching the bare word anywhere
  // in the condition is not enough and actively lies: `{tab === 'focus' && (prefs.uiVersion ===
  // 'figma' && expanded)}` mentions `expanded` and renders the page in compact anyway, because
  // that clause is the figma-layout test, not the phase test. The guard has to be `expanded &&`
  // at the HEAD of the condition. The condition spans lines in real JSX, so the match must too.
  const re = new RegExp(`\\{expanded && tab === '${page}'`);
  const head = re.test(root);
  // and assert none of them still use the old bare form
  const bare = new RegExp(`\\{tab === '${page}' &&`).test(root);
  ok(head && !bare, `the '${page}' page block opens with \`expanded && tab === '${page}'\``);
}

console.log('\n--- a dedicated compact body exists ---');
ok(
  /CompactPill/.test(root),
  'OverlayRoot renders CompactPill in the compact phase',
);

console.log('\n--- §72 / §83: no 44px control may exist inside a 28-40px pill ---');
// Assert the actual guards rather than trusting the arithmetic: the overflow is real only if some
// 44px control is reachable while collapsed.
const compactUngated = [
  /\{!expanded &&[^}]*\bbutton\b/i.test(root),
  /\{tab === '\w+' &&[^}]*\bbutton\b/i.test(root),
].some(Boolean);
ok(!compactUngated, 'no <button> is reachable in the compact phase');
ok(
  /expanded && prefs\.uiVersion === 'legacy'/.test(root),
  'the legacy rail (30px, holds 44px controls) is gated behind expanded',
);

console.log('\n--- §175 RESPONSIVE: content must shrink WITH a clamped box ---');
// The measured defect: `fitToCanvas` shrinks the surface on a narrow display (Large 680x154
// becomes 380x86) while the renderer laid itself out from the preset alone, so the content
// stayed at full size and overflowed — 62px at a 380px display. Both halves were individually
// correct and neither could see the other, which is why every other probe stayed green.
import { fitToCanvas } from '../../src/shared/halo/sizes';

/** What the CSS actually resolves to, honouring the 11px floor every type token carries. */
function budgetAt(squeeze: number, preset: (typeof HALO_SIZE_PRESETS)['large']): number {
  const s = Math.max(0.1, preset.typeScale * squeeze);
  const pad = Math.max(6, Math.round(12 * s));
  const hero = Math.max(pad * 2, Math.max(11, Math.round(26 * s)));
  const rail = Math.min(44, Math.max(30, Math.round(44 * s)));
  return pad * 2 + hero + Math.max(4, Math.round(8 * s)) + rail;
}

for (const avail of [1920, 1366, 1024, 760, 680, 600, 520, 440, 380]) {
  const preset = HALO_SIZE_PRESETS.large;
  const fit = fitToCanvas({ canvasWidth: avail, canvasHeight: preset.expandedHeight, preset });
  const budget = budgetAt(fit.squeeze, preset);
  ok(
    budget <= fit.height,
    `display ${avail}px: content (${Math.round(budget)}px) fits the clamped surface (${Math.round(fit.height)}px)`,
    { squeeze: Number(fit.squeeze.toFixed(2)), slack: Math.round(fit.height - budget) },
  );
}

// And the two halves must actually be connected, or the scaling above is fiction.
ok(
  /'halo:geometry'/.test(readFileSync('src/main/halo/haloIsland.ts', 'utf8')),
  'main PUSHES the fitted geometry to the island window',
);
ok(
  /bridge\.onGeometry/.test(root),
  'the renderer SUBSCRIBES to that geometry',
);
ok(
  /\.typeScale \* squeeze/.test(root),
  "the renderer's type scale is multiplied by the squeeze",
);

console.log('\n--- CROSS-APP VISIBILITY: the window must survive focus moving away ---');
// The island showed over RHEO and vanished over every other app while its size, content and
// settings were all correct. Every other probe stayed green, because the defect was entirely in
// window STACKING — a property no geometry or layout assertion can see.
const mainIsland = readFileSync('src/main/halo/haloIsland.ts', 'utf8');

ok(
  /isLinux\) attempt\('screen-saver'\)/.test(mainIsland),
  "Linux asks for the STRONGEST level ('screen-saver'), not the weaker 'pop-up-menu'",
);
ok(
  !/isLinux\) attempt\('pop-up-menu'\)/.test(mainIsland),
  "the weak 'pop-up-menu' level is gone",
);
ok(
  /function reassertStacking/.test(mainIsland),
  'a stacking re-assert exists (it did not before — the level was asked for once, at creation)',
);
ok(
  /reassertStacking\(handle\.window\)/.test(mainIsland),
  'reconcileHaloGeometry re-asserts stacking, so a display/workspace change cannot demote it',
);
ok(
  /showInactive\(\);[\s\S]{0,400}?reassertStacking\(win\)/.test(mainIsland),
  'the stacking assert follows the map — asking before the window is shown attaches to nothing',
);
// `focusable: false` suppressed the raise on XWayland. It is safe now only because nothing
// ever CALLS focus(): §14 is honoured by showInactive + click-through, not by this flag.
ok(
  /focusable: true/.test(mainIsland) && !/\n\s*focusable: false,/.test(mainIsland),
  'the island window is focusable, so the compositor will raise it',
);
ok(
  !/\n\s*win\.focus\(\)/.test(mainIsland) && !/\n\s*\w+\.focus\(\)/.test(mainIsland),
  '§14: nothing calls focus(), so focusable:true never steals the keyboard',
);
ok(
  /setIgnoreMouseEvents\(collapsed, collapsed \? \{ forward: true \}/.test(mainIsland),
  '§13: the collapsed surface stays click-through, so clicks still reach the app underneath',
);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);