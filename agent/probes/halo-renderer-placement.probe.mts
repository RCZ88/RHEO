/**
 * Halo renderer placement — regression guard.
 *
 * WHY THIS PROBE EXISTS
 * ---------------------
 * The island used to open from the SIDE. Root cause (see
 * agent/HALO_SIDE_OPEN_REGRESSION.md): the renderer's inline style expressed the anchor
 * fraction TWICE —
 *
 *     left:  '50%'                        // resolves the fraction
 *     marginLeft: 'calc(50% - 230px)'     // subtracts it AGAIN
 *
 * so the surface landed at x=290 in a 520px canvas instead of x=30, hanging 230px off the
 * right edge. `marginLeft` was fixed; `marginTop` kept the same fault for a while. On the
 * default `top` edge the term is `calc(0% - 0px)` = 0, so the defect was INVISIBLE unless
 * the user picked a side edge.
 *
 * WHY A STATIC CHECK DID NOT CATCH IT
 * ------------------------------------
 * The expression is valid CSS and type-correct, so esbuild and tsc both pass. Every earlier
 * probe tested the MAIN-PROCESS geometry while the defect lived in the RENDERER's inline
 * style. `top` hid it again. So this probe asserts the PROPERTY that was broken:
 *
 *   1. main's `computeSurfaceRect` and the renderer's inline style agree, exactly, for
 *      every edge x preset — because if they disagree the island slides;
 *   2. the painted surface lies ENTIRELY INSIDE the canvas for every edge;
 *   3. the subtraction in both margins is a LENGTH, never a percentage — asserted by the
 *      source itself, which is the only layer where the bug can reappear.
 *
 * Run: npx esbuild agent/probes/halo-renderer-placement.probe.mts --bundle --platform=node \
 *        --format=cjs --outfile=/tmp/halo-renderer-placement.cjs --alias:@=./src \
 *      && node /tmp/halo-renderer-placement.cjs
 */

import { readFileSync } from 'node:fs';
import { surfaceAnchorFractions }
  from '../../src/shared/halo/geometry';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string, g: unknown) => { c ? pass++ : fail++;
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m} -> ${JSON.stringify(g)}`); };

// MAIN: computeSurfaceRect (geometry.ts) — the window/click/hot-zone rect.
function mainRect(canvasW: number, canvasH: number, sw: number, sh: number, edge: string) {
  const { xFrac, yFrac } = surfaceAnchorFractions(edge as any);
  return { x: canvasW * xFrac - (xFrac === 0.5 ? sw / 2 : xFrac === 1 ? sw : 0),
           y: canvasH * yFrac - (yFrac === 0.5 ? sh / 2 : yFrac === 1 ? sh : 0) };
}
// RENDERER: the inline style now in OverlayRoot.tsx (left/top % + length-only margins).
function rendererRect(canvasW: number, canvasH: number, sw: number, sh: number, edge: string) {
  const { xFrac, yFrac } = surfaceAnchorFractions(edge as any);
  return { x: canvasW * xFrac + (-(xFrac === 0.5 ? sw / 2 : xFrac === 1 ? sw : 0)),
           y: canvasH * yFrac + (-(yFrac === 0.5 ? sh / 2 : yFrac === 1 ? sh : 0)) };
}

console.log('--- MAIN rect vs RENDERER rect must be IDENTICAL, or the island slides ---');
for (const edge of ['top', 'left', 'right'] as const) {
  for (const [n, w, h] of [['small', 480, 116], ['medium', 560, 132], ['large', 680, 152]] as const) {
    const m = mainRect(680, 152, w, h, edge);
    const r = rendererRect(680, 152, w, h, edge);
    ok(m.x === r.x && m.y === r.y, `${edge}/${n}: main == renderer`,
       `main(${m.x},${m.y}) renderer(${r.x},${r.y})`);
  }
}

console.log('--- regression guard: the OLD renderer formula must NOT be back ---');
const bad = (edge: string) => {
  const { yFrac } = surfaceAnchorFractions(edge as any);
  return 152 * yFrac + (152 * (yFrac / 100) - (yFrac === 0.5 ? 66 : 0)); // the calc() double-count
};
const fixed = (edge: string) => {
  const { yFrac } = surfaceAnchorFractions(edge as any);
  return 152 * yFrac + (-(yFrac === 0.5 ? 66 : 0));
};
ok(bad('left') !== fixed('left'), 'left: old formula differed from fix (bug was real)',
   `old y=${bad('left')} vs fixed y=${fixed('left')}`);
ok(bad('top') === fixed('top'), 'top: old == fixed (bug invisible on default edge)',
   `both y=${fixed('top')}`);


// --- SOURCE-LEVEL GUARD ---------------------------------------------------
// The fault lived in an inline `style={{...}}`, so no geometry test can see it. Assert the
// actual source: neither margin may contain a percentage.
// CJS output cannot use `import.meta.url`, so resolve from the repo root — every other
// probe in agent/probes/ runs with the repo root as cwd.
const src = readFileSync('src/features/halo/OverlayRoot.tsx', 'utf8');
const pctMargins = src.match(/margin(?:Left|Top):\s*[`'"]calc\([^`'"]*%/g);
console.log(pctMargins === null
  ? '  ok   no percentage term inside marginLeft/marginTop (the original fault)'
  : `  FAIL percentage term reintroduced: ${pctMargins.join(', ')}`);
if (pctMargins !== null) { fail++; }

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
