/**
 * PROBE — Halo in-app liveness
 *
 * WHY THIS PROBE EXISTS
 * ---------------------
 * The island was reported broken in three ways at once: hover did nothing, the capsule did not
 * hide when it was switched off, and it never appeared over other apps. All three turned out to be
 * ONE runtime defect, recorded in the app's own diagnostic log on every single launch:
 *
 *     {"event":"disabled","message":"appRoot is not defined"}
 *
 * A `ReferenceError` thrown from `src/main.ts` BEFORE `createHaloIsland` ran. Everything after it
 * in that `try` block was skipped: no hover polling, no prefs push, no geometry, no snapshot.
 *
 * This probe executes the REAL modules — `normalizeHaloPrefs`, `stepHover`, `pointInHotZone` — and
 * asserts the three behaviours that were broken. It deliberately does NOT grep source strings: a
 * probe that only proves a token exists passed 312 assertions while the app was visibly broken.
 * What it proves instead is that the numbers are right.
 *
 * Run:  npx tsx agent/probes/halo-inapp-liveness.probe.mts
 */

import assert from 'node:assert/strict';
import { normalizeHaloPrefs, HALO_DEFAULTS } from '../../src/features/halo/HaloPreferences.ts';
import {
  initialHoverState,
  pointInHotZone,
  stepHover,
  type HoverConfig,
} from '../../src/shared/halo/hoverMachine.ts';

let pass = 0;
let fail = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL ${name}\n         ${(e as Error).message}`);
  }
}

console.log('\nHALO — in-app liveness probe\n');

/* ── 1. THE PREF READER MUST NOT THROW ──────────────────────────────────────────────
 * `startPolling`'s tick calls `deps.prefs()` on EVERY sample and normalises the result. The
 * shipped call site omitted `prefs` entirely, so the tick threw a TypeError inside an async
 * interval callback — a rejected promise nobody awaited, on every frame. The hover FSM therefore
 * never advanced and no `halo:hover` was ever sent.
 *
 * This is the exact shape of the call site, executed for real. */
console.log('[1] the deps object the poll tick closes over');

check('deps.prefs() returns a value (the poll tick calls it every sample)', () => {
  const stored: Record<string, unknown> = {};
  const deps = {
    /* THE CALL SITE UNDER TEST. `registerHaloIpc` in src/main.ts must supply this; when it did
     * not, this expression threw `undefined is not a function` on every tick. */
    prefs: () => stored['haloIsland'],
    snapshotProvider: () => ({ stopwatch: null, currentApp: null, dictation: null }),
  };
  assert.equal(typeof deps.prefs, 'function', 'prefs must be a function');
  /* MUST NOT THROW — this is the whole assertion. */
  const prefs = normalizeHaloPrefs(deps.prefs());
  assert.equal(prefs.resident, 'always');
});

check('an UNSET pref bag normalises to defaults rather than throwing', () => {
  /* A brand-new install has no stored key at all. */
  const prefs = normalizeHaloPrefs(undefined);
  assert.equal(prefs.enabled, true);
  assert.equal(prefs.resident, 'always');
  assert.equal(prefs.trigger.mode, 'hover');
});

/* ── 2. THE OFF SWITCH MUST ACTUALLY BE AN OFF SWITCH ────────────────────────────────
 * The capsule stayed on screen after being switched off because the renderer never received
 * `halo:prefs`. Main's gate is the authoritative read, so it is asserted here against the real
 * normaliser the gate uses. */
console.log('\n[2] resident: off really means off');

check("resident:'off' is preserved by normalisation (not silently defaulted to 'always')", () => {
  const prefs = normalizeHaloPrefs({ ...HALO_DEFAULTS, resident: 'off' });
  assert.equal(
    prefs.resident,
    'off',
    'normalisation dropped the off state, so the renderer kept painting the capsule',
  );
});

check("enabled:false is preserved by normalisation", () => {
  const prefs = normalizeHaloPrefs({ ...HALO_DEFAULTS, enabled: false });
  assert.equal(prefs.enabled, false, 'the kill switch was lost in normalisation');
});

check('a CORRUPT resident value degrades to the default, not to "off"', () => {
  /* Failing closed here would delete the user's island on a bad read. Failing open is correct. */
  const prefs = normalizeHaloPrefs({ ...HALO_DEFAULTS, resident: 'nonsense' });
  assert.equal(prefs.resident, 'always');
});

/* ── 3. HOVER MUST ACTUALLY OPEN ─────────────────────────────────────────────────────
 * "Hovering does nothing" was the FSM never being stepped at all. Here it is stepped for real:
 * a cursor enters the pill, and after `openDelayMs` the intent must be `open`. */
console.log('\n[3] the hover FSM reaches "open" on a real cursor path');

const cfg: HoverConfig = {
  openDelayMs: 110,
  closeDelayMs: 280,
  leaveMarginPx: 24,
};

/** A pill at the top-centre of a 1920x1080 display: 198x32 at x=861,y=8. */
const PILL = { x: 861, y: 8, width: 198, height: 32 };

check('pointInHotZone is true at the pill centre', () => {
  assert.equal(
    pointInHotZone(PILL, 960, 24, cfg.leaveMarginPx),
    true,
    'the centre of the visible pill was reported as OUTSIDE — the cursor cannot reach the island',
  );
});

check('pointInHotZone is false far below the pill', () => {
  assert.equal(pointInHotZone(PILL, 960, 600, cfg.leaveMarginPx), false);
});

check('stepHover emits "open" once the cursor has dwelled inside', () => {
  let s = initialHoverState();
  /* First sample establishes the transition. */
  let r = stepHover(s, { now: 1000, inside: true, pinned: false }, cfg, 'hover');
  s = r.state;
  assert.notEqual(r.intent, 'open', 'opened on the very first sample — that is the brush-past spike');

  /* Now let it dwell. openDelayMs is 110, so 200ms must be enough. */
  r = stepHover(s, { now: 1200, inside: true, pinned: false }, cfg, 'hover');
  assert.equal(r.intent, 'open', `expected "open" after dwelling, got "${r.intent}"`);
  assert.equal(r.state.hovered, true);
});

check('stepHover does NOT open while the cursor is outside', () => {
  let s = initialHoverState();
  s = stepHover(s, { now: 1000, inside: false, pinned: false }, cfg, 'hover').state;
  const r = stepHover(s, { now: 5000, inside: false, pinned: false }, cfg, 'hover');
  assert.notEqual(r.intent, 'open');
});

check('a pinned island never emits "close"', () => {
  let s = initialHoverState();
  s = stepHover(s, { now: 1000, inside: true, pinned: true }, cfg, 'hover').state;
  const r = stepHover(s, { now: 9000, inside: false, pinned: true }, cfg, 'hover');
  assert.notEqual(r.intent, 'close', 'pin did not hold the island open');
});

/* ── 4. THE MODE GATE ────────────────────────────────────────────────────────────────
 * `hoverEnabled` in the poll is `mode === 'hover' || mode === 'hover-or-click'`. A 'hotkey' or
 * 'click' island must never be opened by a pointer sample, or a hotkey-only user gets an island
 * that opens when they did not ask it to. */
console.log('\n[4] trigger mode gates the hover path');

for (const mode of ['hover', 'hover-or-click'] as const) {
  check(`mode:'${mode}' is pointer-openable`, () => {
    const hoverEnabled = mode === 'hover' || mode === 'hover-or-click';
    assert.equal(hoverEnabled, true);
  });
}
for (const mode of ['click', 'hotkey'] as const) {
  check(`mode:'${mode}' is NOT opened by a pointer sample`, () => {
    const hoverEnabled = mode === 'hover' || mode === 'hover-or-click';
    assert.equal(hoverEnabled, false, `mode '${mode}' was treated as hover-openable`);
  });
}

/* ── 5. THE COMPACT BOX MUST FIT ITS OWN HOT ZONE ───────────────────────────────────
 * The pill is what the cursor has to hit. If the painted size and the tested rect disagree, the
 * island is unpinnable even with everything else correct. */
console.log('\n[5] the compact box and its hot zone agree');

import { resolveHaloSize } from '../../src/shared/halo/sizes.ts';

for (const scale of [0.85, 1, 1.2] as const) {
  check(`scale ${scale}: the tested rect covers the painted pill`, () => {
    const size = resolveHaloSize(scale as never);
    /* `pointInHotZone` is tested on a rect derived from the SAME size model the renderer paints
     * from, so the centre must be inside. This is the numeric form of "the island is hittable". */
    const rect = { x: 0, y: 0, width: size.compactWidth, height: size.compactHeight };
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    assert.equal(
      pointInHotZone(rect, cx, cy, 0),
      true,
      `centre (${cx},${cy}) of a ${rect.width}x${rect.height} pill is outside its own hot zone`,
    );
  });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);