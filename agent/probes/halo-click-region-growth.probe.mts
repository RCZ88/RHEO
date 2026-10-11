/**
 * The click region must GROW with the panel — HALO §12/§13.
 *
 * THE BUG THIS GUARDS: the island opened to its full expanded size but stayed click-through
 * with a compact-pill window shape, so every click on the visible UI passed straight through
 * to the app underneath. The panel was painted, animated, and completely unusable.
 *
 * ROOT CAUSE: two authorities for "is the island open?" — the renderer's `useState` and the
 * main process's `handle.expanded`. `open()` in OverlayRoot set only the local flag, so main
 * never learned the panel opened and never called `applyClickRegion`. Fixed by routing every
 * renderer open through `bridge.open()`; this probe asserts the SOURCE still does that, plus
 * the numeric property that the expanded region strictly contains the collapsed one.
 */
import { readFileSync } from 'node:fs';
import { computeSurfaceRect } from '../../src/shared/halo/geometry';
import { HALO_SIZE_PRESETS } from '../../src/shared/halo/sizes';

let pass = 0, fail = 0;
const ok = (c: boolean, m: string, g?: unknown) => {
  if (!c) fail++; else pass++;
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}${g !== undefined ? ` -> ${JSON.stringify(g)}` : ''}`);
};

const canvas = { x: 0, y: 0, width: 520, height: 300 };
// `computeSurfaceRect` takes a Size, not a preset — pass the sizes it is called with.
const compact = computeSurfaceRect(canvas, { width: 232, height: 32 }, 'top');
const expanded = computeSurfaceRect(canvas, { width: 520, height: 123 }, 'top');

console.log('--- numeric property: the expanded region must cover the collapsed one ---');
ok(expanded.height >= 40, 'expanded region is at least a pill tall',
   `${expanded.width}x${expanded.height}`);
ok(expanded.x <= compact.x && expanded.x + expanded.width >= compact.x + compact.width,
   'expanded region spans at least the pill horizontally',
   `pill ${compact.x}..${compact.x + compact.width} vs region ${expanded.x}..${expanded.x + expanded.width}`);
ok(expanded.y <= compact.y && expanded.y + expanded.height >= compact.y + compact.height,
   'expanded region spans at least the pill vertically',
   `pill ${compact.y}..${compact.y + compact.height} vs region ${expanded.y}..${expanded.y + expanded.height}`);

console.log('--- source guard: the renderer MUST tell main when it opens ---');
const root = readFileSync('src/features/halo/OverlayRoot.tsx', 'utf8');

const openFn = root.match(/const open = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[clearTimers\]\);/);
ok(openFn !== null, 'found the open() callback');
ok(openFn !== null && /bridge\?\.open\?\.\(\)/.test(openFn[0]),
   'open() notifies main via bridge.open()', openFn ? 'present' : 'callback not found');

// The real failure mode: a raw setExpanded(true) OUTSIDE open()/close().
const rawOpens = [...root.matchAll(/setExpanded\(true\)/g)];
const openBody = openFn ? openFn[0] : '';
const rawOutside = rawOpens.filter((m) => !openBody.includes(m[0]));
ok(rawOutside.length === 0,
   'no setExpanded(true) bypasses open() (every open tells main)',
   `${rawOutside.length} stray`);

const closeFn = root.match(/const close = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[clearTimers\]\);/);
ok(closeFn !== null && /bridge\?\.close\?\.\(\)/.test(closeFn[0]),
   'close() notifies main via bridge.close()', closeFn ? 'present' : 'callback not found');

console.log('--- source guard: main must not PIN on a plain open ---');
const main = readFileSync('src/main/halo/haloIsland.ts', 'utf8');
const handler = main.match(/ipcMain\.handle\('halo:open',[\s\S]*?\n    \}\);/);
ok(handler !== null, "found the 'halo:open' handler");
ok(handler !== null && !/handle\.pinned\s*=\s*true/.test(handler[0]),
   'halo:open does NOT pin (hover-open must stay dismissible)');

console.log('--- source guard: clickShield must not skip setShape ---');
// Span the whole function body up to its closing brace.
const apply = main.match(/function applyClickRegion[\s\S]*?\n  }\n/);
ok(apply !== null, 'found applyClickRegion');
ok(apply !== null && !/clickShield === 'canvas'\) return/.test(apply[0]),
   "'canvas' shield no longer returns before setShape (no giant hitbox)");

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
