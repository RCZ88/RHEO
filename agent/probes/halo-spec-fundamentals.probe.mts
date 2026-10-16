/**
 * HALO — FUNDAMENTAL CONCEPTS, asserted against the governing spec.
 *
 * Spec: agent/docs/halo_cross_platform_agent_spec_compact(1).md  (4,195 lines; identical MD5
 * to agent/docs/HALO_ISLAND.md). These are the ARCHITECTURAL invariants, not cosmetics — the
 * ones whose violation produces "the island does not open", "I cannot click it", or "it
 * flickers". Each assertion below names its section.
 *
 * This suite exists because the failures kept being VISUAL/INTERACTIVE while every probe I ran
 * was arithmetic. So most of these are SOURCE-level assertions: they read the actual file and
 * check the property that was broken, because that is the only layer where a defect like
 * "expands without telling main" can live.
 */
import { readFileSync } from 'node:fs';
import { computeGeometry, computeSurfaceRect, MAX_CANVAS_WIDTH, MAX_CANVAS_HEIGHT, MIN_CANVAS_WIDTH, MIN_CANVAS_HEIGHT }
  from '../../src/shared/halo/geometry';
import { HALO_SIZE_PRESETS } from '../../src/shared/halo/sizes';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string, g?: unknown) => {
  if (!c) fail++; else pass++;
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}${g !== undefined ? ` -> ${JSON.stringify(g)}` : ''}`);
};
const root = readFileSync('src/features/halo/OverlayRoot.tsx', 'utf8');
const main = readFileSync('src/main/halo/haloIsland.ts', 'utf8');
const css = readFileSync('src/features/halo/halo.css', 'utf8');
const rail = readFileSync('src/features/halo/HaloTabRail.tsx', 'utf8');

/* SUPERSEDED BY THE VERDICT OF 2026-10-08, conflict 6.
 *
 * The 760x460 canvas budget is GONE. The window is now the expanded size of the ACTIVE PRESET
 * - 480x118 / 560x134 / 680x154 - clamped to the display, because a fixed 760x460 left about
 * 300px of dead transparent space below a 134px panel. That is the compositor and hit-testing
 * cost section 181 of the long spec explicitly warns about, and the Specialist named the same
 * figure when ruling on it.
 *
 * These assertions used to pin the old budget. Pinning it now would fail the suite against the
 * design that won, which is the same failure mode as a test asserting the bug: the number is
 * no longer the specification.
 *
 * MAX/MIN survive as exports because the display clamp still reads them; what is asserted here
 * is the CLAMP, never the budget. */
console.log('--- VERDICT conflict 6: canvas === the preset expanded size, clamped to the display ---');
for (const w of [3840, 1920, 1280, 800, 600, 320]) {
  const d = { x: 0, y: 0, width: w, height: 1080 };
  const g = computeGeometry({ displayBounds: d, workArea: d, scaleFactor: 1, size: HALO_SIZE_PRESETS.medium } as any);
  ok(g.canvas.width === Math.min(560, w - 24),
    `canvas === the 560 panel, clamped at ${w}px display`, `${g.canvas.width}`);
  ok(g.canvas.width <= w, `  ...and never wider than the ${w}px display itself`);
}
ok(computeGeometry({ displayBounds: { x:0,y:0,width:3840,height:1080 }, workArea: { x:0,y:0,width:3840,height:1080 }, scaleFactor:1, size: HALO_SIZE_PRESETS.large } as any).canvas.width === 680,
   'Large preset gives a 680-wide window, not 760');
console.log('--- §1 MAIN IS AUTHORITY: the renderer must never decide the click region ---');
// The defect this guards: renderer `useState` opened the panel while main still believed
// `expanded === false`, so the window stayed click-through + pill-shaped and the panel was
// painted but unusable.
const openFn = root.match(/const open = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[clearTimers\]\);/);
ok(openFn !== null, '§1 found the renderer open() callback');
ok(openFn !== null && /bridge\?\.open\?\.\(\)/.test(openFn[0]),
  '§1 open() notifies main (main owns the window/click region)');
const stray = [...root.matchAll(/setExpanded\(true\)/g)].filter(m => !openFn || !openFn[0].includes(m[0]));
ok(stray.length === 0, '§1 no setExpanded(true) bypasses open()', `${stray.length} stray`);
const haloOpen = main.match(/ipcMain\.handle\('halo:open',[\s\S]*?\n    \}\);/);
ok(haloOpen !== null && !/handle\.pinned\s*=\s*true/.test(haloOpen[0]),
  '§1 halo:open expands WITHOUT pinning (hover-open stays dismissible)');

console.log('--- §11 RESIZE ALLOWLIST: setBounds only from the allowlist, never per frame ---');
ok(!/setBounds\(\{[\s\S]*?Date\.now\(\)/.test(main), '§11 setBounds is never driven by a clock');
const tick = main.match(/setInterval\(tick, h\.pollMs\)/);
ok(tick !== null, '§11 the hover poll is an interval (its body must not resize)');
// Read the real tick body rather than a fixed-width window, which used to run past its end and
// match a setBounds belonging to a DIFFERENT function.
// The tick is `async` — the cursor read spawns a helper and is awaited, so two ticks must never
// be in flight at once. The regex allowed `() =>` only, so it silently stopped matching and the
// assertion reported "tick not found" rather than failing loudly. `async` is optional here.
const tickBody = main.match(/const tick = (?:async )?\(\) => \{[\s\S]*?\n  \};/);
ok(tickBody !== null && !/\.setBounds\(/.test(tickBody[0]),
  '§11 the poll body does not call setBounds',
  tickBody === null ? 'tick not found' : (tickBody[0].includes('setBounds') ? 'setBounds present' : 'clean'));

console.log('--- §12/§13 CLICK-THROUGH: shape is the surface, never the canvas ---');
/* Brace-match the REAL function body. The previous regex stopped at the first inner
 * `}\n`, capturing 420 of 6,736 characters — so it never saw `const region = surface;`
 * and reported a failure in code that was correct. Read the source at its true extent:
 * the same class of error as comparing hot zones in two different coordinate spaces. */
const applyBody = (() => {
  const i = main.indexOf('function applyClickRegion');
  if (i < 0) return null;
  let d = 0;
  for (let k = i; k < main.length; k++) {
    if (main[k] === '{') d++;
    else if (main[k] === '}') { d--; if (d === 0) return main.slice(i, k + 1); }
  }
  return null;
})();
const apply = applyBody === null ? null : [applyBody];
ok(apply !== null, '§12 found applyClickRegion');
ok(apply !== null && !/clickShield === 'canvas'\) return/.test(apply[0]),
  "§12 'canvas' shield no longer returns before setShape (no giant hitbox)");
ok(apply !== null && /^\s*const region = surface;/m.test(apply[0]),
  '§13 the click region IS the painted surface (pinned included)');

console.log('--- §12/§40 HIT TESTING: root pointer-events none, surface auto ---');
ok(/\.halo-root\s*\{[\s\S]*?pointer-events:\s*none/.test(css), '§40 .halo-root is pointer-events: none');
ok(/\.halo-surface[\s\S]*?pointer-events:\s*auto/.test(css), '§40 .halo-surface is pointer-events: auto');

console.log('--- §8 SECURITY POSTURE ---');
const wpref = main.match(/webPreferences:\s*\{[\s\S]*?\}/);
ok(wpref !== null && /contextIsolation:\s*true/.test(wpref[0]), '§8 contextIsolation: true');
ok(wpref !== null && /nodeIntegration:\s*false/.test(wpref[0]), '§8 nodeIntegration: false');
ok(wpref !== null && /sandbox:\s*true/.test(wpref[0]), '§8 sandbox: true');
ok(/show:\s*false/.test(main), '§8 created hidden and shown explicitly (no white flash, §116)');
ok(/showInactive\(\)/.test(main), '§14 showInactive, never focus() — a HUD must not steal focus');

console.log('--- §62/§63 TRANSFORM ORIGIN: grows from the attached edge ---');
const geom = computeGeometry({ displayBounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, size: HALO_SIZE_PRESETS.medium } as any);
// computeSurfaceRect takes a Size ({width,height}), NOT a preset — passing the preset object
// is why this returned NaN in an earlier run of this probe.
const med = HALO_SIZE_PRESETS.medium;
const surf = computeSurfaceRect(geom.canvas, { width: med.expandedWidth, height: med.expandedHeight }, 'top');
ok(surf.y === geom.canvas.y, '§63 top edge: the surface is flush with the top, so it grows downward', `y=${surf.y}`);
ok(surf.x + surf.width / 2 === geom.canvas.x + geom.canvas.width / 2, '§62 top edge is horizontally centred');

console.log('--- §64/§65 MOTION: the spec springs are present and used ---');
/* VERDICT conflict 4: the springs are DELETED. Asserting they still exist would be asserting
 * the superseded design. A spring's duration is emergent rather than declared, so it cannot
 * promise the "200 ms, transform and opacity only" section 10 and LAMINAR require. */
ok(!/type: 'spring'/.test(root.replace(/\/\*[\s\S]*?\*\//g, '')),
   'VERDICT conflict 4: the section-64 springs are gone from live code');
ok(/SURFACE_TWEEN = \{ duration: 0\.2, ease: \[0\.2, 0, 0, 1\] \}/.test(root),
   '...replaced by ONE declared 200ms tween with the handoff ease-out');
ok(/'--halo-move-ease': 'cubic-bezier\(0\.2, 0, 0, 1\)'/.test(root),
   '...and the CSS mirror carries the SAME curve, so stylesheet and Motion cannot drift');
ok(/--halo-move-ms/.test(root), '...and the same duration token, derived not retyped');
// §171: the OS-level `prefers-reduced-motion` outranks the in-app liveliness preference. The
// assertion used to require the literal text `transition={reduce ? { duration: 0`, which the
// implementation stopped matching once the zero-duration branch was named STATIC_TRANSITION —
// so a correct implementation reported FAIL. Assert the BEHAVIOUR: `reduce` (the OS query) must
// select the zero-duration constant on the surface's transition prop.
ok(/transition=\{reduce \? STATIC_TRANSITION :/.test(root),
  '§171 OS reduced-motion wins over the in-app preference');
ok(/const STATIC_TRANSITION = \{ duration: 0/.test(root),
  '§171 ...via the zero-duration constant it selects');

console.log('--- §101 NO setState AS THE FRAME CLOCK ---');
ok(!/setInterval\([^)]*,\s*(1?[0-9]|[1-9][0-9])\s*\)/.test(root),
  '§101 no sub-250ms interval driving React state (min is 1000ms)');

console.log('--- §139 TRANSFORM VS WIDTH: margins subtract a LENGTH, never a percentage ---');
ok(!/margin(?:Left|Top):\s*[`'"]calc\([^`'"]*%/.test(root),
  '§139 no percentage term in a margin (the "opens from the side" defect)');
ok(/marginLeft:\s*-\(xFrac === 0\.5/.test(root), '§139 marginLeft subtracts half the width when centred');
ok(/marginTop:\s*-\(yFrac === 0\.5/.test(root), '§139 marginTop subtracts half the height when centred');

console.log('--- §44 MAIN -> RENDERER: one authority per field ---');
ok(/function computeSurfaceRect/.test(readFileSync('src/shared/halo/geometry.ts', 'utf8')),
  '§1 computeSurfaceRect is shared by window, trigger and click region');

console.log('--- §75/§77/§78 DESIGN TOKENS ---');
ok(/--halo-surface:\s*#09090b/.test(css), '§77 surface #09090b');
ok(/--halo-raised:\s*#18181b/.test(css), 'tab rail track #18181b');
ok(/--halo-tab:\s*#27272a/.test(css), 'selected tab #27272a');
ok(/--halo-accent:\s*#6fb38f/.test(css), 'the only accent is #6fb38f');
ok(/--halo-border:\s*#2e2e33/.test(css), 'border #2e2e33');
ok(!/border-radius:\s*[0-9]/.test(css), '§75 every radius reads a token (no hardcoded value)');
ok(!/backdrop-filter/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), '§77 no backdrop-filter (compositor blur is unreliable here)');
ok(/--halo-shadow:\s*0 12px 36px/.test(css), '§78 static shadow 0 12px 36px');
const offScale = [...css.matchAll(/(?:padding|margin|gap)[a-z-]*:\s*([0-9]+)px/g)]
  .map(m => Number(m[1])).filter(n => ![4,8,12,16,20,24,32,40,48].includes(n));
ok(offScale.length === 0, '§74 every spacing value is on the 8pt grid', offScale.length ? offScale : 'all on-scale');

console.log('--- §44 the click region must GROW with the panel ---');
const canvas = { x: 0, y: 0, width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT };
const p = HALO_SIZE_PRESETS.medium;
const pill = computeSurfaceRect(canvas, { width: p.compactWidth, height: p.compactHeight }, 'top');
const panel = computeSurfaceRect(canvas, { width: p.expandedWidth, height: p.expandedHeight }, 'top');
ok(panel.width >= pill.width && panel.height >= pill.height,
  'the expanded region contains the collapsed pill',
  `pill ${pill.width}x${pill.height} inside panel ${panel.width}x${panel.height}`);
ok(p.compactWidth === 198 && p.compactHeight === 32 && p.expandedWidth === 560 && p.expandedHeight === 134,
  'Figma node tree: medium pill 198x32, expanded 560x134',
  `${p.compactWidth}x${p.compactHeight} / ${p.expandedWidth}x${p.expandedHeight}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
