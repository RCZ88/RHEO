// Tests the REAL src/lib/ambient.ts, not a copy of it.
//
//   npx esbuild src/lib/ambient.ts --bundle --platform=node --format=cjs \
//     --outfile=/tmp/opencode/df-scope-out/ambient.cjs --loader:.md=text
//   node agent/probes/ambient-logic-probe.mjs
//
// WHY THIS SHAPE: a probe that re-implements the module it is checking proves
// nothing about the module. The gating logic decides whether the wash paints at
// all, so the probe bundles the shipped file and drives it.
//
// The module touches `localStorage` / `window` / `document` inside try/catch, so
// minimal shims are enough and no DOM is required.

const MOD = process.env.AMBIENT_CJS || '/tmp/opencode/df-scope-out/ambient.cjs';

// Minimal window/localStorage. A Map-backed store, so the probe can assert on
// what was actually persisted rather than trusting the return value alone.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const listeners = [];
globalThis.window = {
  addEventListener: (t, fn) => listeners.push([t, fn]),
  removeEventListener: () => {},
  dispatchEvent: e => { for (const [t, fn] of listeners) if (t === e.type) fn(e); return true; },
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// This file is `.mjs` (the repo is `type: module`), so `require` does not exist
// in its scope. `createRequire` is the supported way to pull in a CJS bundle
// from an ESM module — and the bundle has to be CJS because esbuild output for
// `--platform=node --format=cjs` is what `lib/ambient.ts` compiles to for the
// main process anyway.
const A = createRequire(import.meta.url)(MOD);

let failures = 0;
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

console.log('\n=== DEFAULTS ===\n');
const d = A.getAmbientPrefs();
console.log(`  ${JSON.stringify(d)}`);
ok('default scope is all', d.scope === 'all');
ok('default intensity is the full 100', d.intensity === 100, `${d.intensity}`);
ok('default is enabled', d.enabled === true);
ok('a fresh store yields defaults, not undefined', d.pages.length === 0);

console.log('\n=== PAGE LIST MUST MATCH index.css EXACTLY ===\n');
// The load-bearing check. `data-page` is what the app actually sets, and
// `src/index.css` is where every one of those ids is declared. A hand-typed list
// drifted from that set once already (15 entries against 21) and the six
// omissions were silently unselectable.
const css = readFileSync(
  new URL('../../src/index.css', import.meta.url),
  'utf8',
);
const declared = new Set(
  [...css.matchAll(/\[data-page="([a-z0-9-]+)"\]/g)].map(m => m[1]),
);
const listed = new Set(A.ALL_AMBIENT_PAGE_IDS);

console.log(`  index.css declares : ${declared.size}`);
console.log(`  AMBIENT_PAGES lists: ${listed.size}`);

const missing = [...declared].filter(id => !listed.has(id));
const extra = [...listed].filter(id => !declared.has(id));

ok('every data-page id in index.css is selectable', missing.length === 0,
  missing.length ? `MISSING: ${missing.join(', ')}` : 'none missing');
ok('the picker lists no id the app cannot produce', extra.length === 0,
  extra.length ? `EXTRA: ${extra.join(', ')}` : 'none extra');
ok('no duplicate ids in the picker', listed.size === A.ALL_AMBIENT_PAGE_IDS.length);

console.log('\n=== SCOPE GATE: ambientAppliesTo() ===\n');
const base = { enabled: true, intensity: 100, spread: 30 };

ok('scope=all paints on any known route', A.ambientAppliesTo('finance', { ...base, scope: 'all', pages: [] }));
ok('scope=all paints even with an empty page list', A.ambientAppliesTo('finance', { ...base, scope: 'all', pages: [] }));
ok('scope=all paints on an unlisted route too', A.ambientAppliesTo('some-new-page', { ...base, scope: 'all', pages: [] }));

ok('scope=selected paints on a ticked route',
  A.ambientAppliesTo('finance', { ...base, scope: 'selected', pages: ['finance'] }));
ok('scope=selected does NOT paint on an unticked route',
  !A.ambientAppliesTo('devices', { ...base, scope: 'selected', pages: ['finance'] }));
ok('scope=selected paints nowhere when nothing is ticked',
  !A.ambientAppliesTo('finance', { ...base, scope: 'selected', pages: [] }));
ok('scope=selected paints nowhere when the route id is unknown',
  !A.ambientAppliesTo(null, { ...base, scope: 'selected', pages: ['finance'] }));

// Every declared route must be reachable under `selected`, or the picker has a
// hole in it that no amount of correct gating will notice.
const unreachable = [...declared].filter(
  id => !A.ambientAppliesTo(id, { ...base, scope: 'selected', pages: [id] }),
);
ok('every declared route can be switched on individually', unreachable.length === 0,
  unreachable.length ? `UNREACHABLE: ${unreachable.join(', ')}` : 'all reachable');

console.log('\n=== OFF SWITCHES BEAT THE SCOPE LIST ===\n');
ok('enabled=false wins even when the route is ticked',
  !A.ambientAppliesTo('finance', { enabled: false, intensity: 100, spread: 30, scope: 'selected', pages: ['finance'] }));
ok('intensity=0 wins even when the route is ticked',
  !A.ambientAppliesTo('finance', { enabled: true, intensity: 0, spread: 30, scope: 'selected', pages: ['finance'] }));

console.log('\n=== PERSISTENCE + SANITISATION (setAmbientPrefs) ===\n');

store.clear();
let r = A.setAmbientPrefs({ scope: 'selected' });
ok('selecting "only some pages" seeds every page, so the toggle is not a no-op',
  r.scope === 'selected' && r.pages.length === A.ALL_AMBIENT_PAGE_IDS.length,
  `${r.pages.length} pages`);

r = A.setAmbientPrefs({ pages: [] });
ok('"Clear" really clears — seeding must not resurrect it',
  r.pages.length === 0, `${r.pages.length} pages`);

// The regression that mattered: a later unrelated write must not re-seed either.
r = A.setAmbientPrefs({ intensity: 80 });
ok('a later unrelated write does not re-seed a deliberately empty list',
  r.pages.length === 0, `${r.pages.length} pages`);

// Re-entering `selected` with nothing chosen SHOULD seed, so the control still
// matches what it claims when the user switches back to it by hand.
r = A.setAmbientPrefs({ scope: 'all' });
ok('switching back to "every page" works', r.scope === 'all');
r = A.setAmbientPrefs({ scope: 'selected' });
ok('re-entering "only some pages" with an empty list seeds it again',
  r.pages.length === A.ALL_AMBIENT_PAGE_IDS.length, `${r.pages.length} pages`);

r = A.setAmbientPrefs({ intensity: 500 });
ok('intensity is clamped to 100', r.intensity === 100, `${r.intensity}`);
r = A.setAmbientPrefs({ intensity: -20 });
ok('intensity is clamped to 0', r.intensity === 0, `${r.intensity}`);
r = A.setAmbientPrefs({ spread: 999 });
ok('spread is clamped to 100', r.spread === 100, `${r.spread}`);

r = A.setAmbientPrefs({ pages: ['finance', 'finance', 'not-a-page', 'documentation'] });
ok('unknown ids are dropped, duplicates collapse',
  r.pages.length === 2 && r.pages.includes('finance') && r.pages.includes('documentation'),
  JSON.stringify(r.pages));

// Order must follow the canonical picker order, not the click order, so the
// persisted list cannot encode a transient UI sequence.
r = A.setAmbientPrefs({ pages: ['settings', 'activity'] });
ok('order is canonical, not the order they were clicked',
  JSON.stringify(r.pages) === '["activity","settings"]', JSON.stringify(r.pages));

console.log('\n=== ROUND-TRIP THROUGH localStorage ===\n');
const written = JSON.parse(store.get('deskflow-ambient'));
ok('scope survives the write', written.scope === 'selected', JSON.stringify(written));
const readBack = A.getAmbientPrefs();
ok('getAmbientPrefs reads back what was written',
  readBack.scope === written.scope && readBack.pages.length === written.pages.length);

store.set('deskflow-ambient', '{"enabled":"yes","intensity":"loud","scope":"nonsense","pages":"nope"}');
const junk = A.getAmbientPrefs();
console.log(`  junk in -> ${JSON.stringify(junk)}`);
ok('a malformed store falls back per-field, never to undefined',
  typeof junk.enabled === 'boolean' && typeof junk.intensity === 'number'
  && Array.isArray(junk.pages) && junk.scope === 'all');

store.set('deskflow-ambient', 'not json at all');
ok('unparseable JSON falls back to defaults', A.getAmbientPrefs().scope === 'all');

console.log('\n=== GRADIENT: THE TWO THEMES MUST DIFFER ===\n');
const prefs = { enabled: true, intensity: 100, spread: 30, scope: 'all', pages: [] };
const gDark = A.ambientGradient(prefs, '#06b6d4', 'dark');
const gLight = A.ambientGradient(prefs, '#0e7490', 'light');
ok('dark and light produce different gradients', gDark !== gLight);
ok('light ceiling is lower than dark (paper must stay paper)',
  hexAlpha(gLight) < hexAlpha(gDark),
  `dark ${hexAlpha(gDark)} vs light ${hexAlpha(gLight)}`);
ok('an unresolvable accent yields "none" rather than grey',
  A.ambientGradient(prefs, null, 'dark') === 'none');

function hexAlpha(g) {
  const m = /, (#\w{6})([0-9a-f]{2})/.exec(g);
  return m ? parseInt(m[2], 16) : -1;
}

console.log(`\n  dark : ${gDark}`);
console.log(`  light: ${gLight}`);

console.log('\n=== INTENSITY 0 MUST COLLAPSE THE WASH ===\n');
const zero = A.ambientGradient({ ...prefs, intensity: 0 }, '#06b6d4', 'dark');
ok('intensity 0 produces a fully transparent gradient', hexAlpha(zero) === 0, `alpha ${hexAlpha(zero)}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);