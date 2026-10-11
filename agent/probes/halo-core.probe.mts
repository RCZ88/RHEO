/**
 * HALO ISLAND — core logic probe.
 *
 * HALO §150/§151/§152 require geometry, hover and router to be unit-tested as
 * pure functions with no Electron import. This probe is that suite, and it is
 * also the only verification available without a build (AGENTS.md §0-0), so it
 * prints NUMBERS rather than asserting silently.
 *
 * Run: npx esbuild agent/probes/halo-core.probe.mts --bundle --platform=node \
 *        --format=esm --outfile=/tmp/halo-probe.mjs && node /tmp/halo-probe.mjs
 */
import { ActivityRouter } from '../../src/shared/halo/activityRouter';
import {
  DEFAULT_HOVER_CONFIG,
  initialHoverState,
  stepHover,
  type HoverState,
} from '../../src/shared/halo/hoverMachine';
import {
  computeGeometry,
  computeHotZone,
  compactWidthForNotch,
  resolveTargetDisplay,
  MAX_CANVAS_WIDTH,
  MIN_CANVAS_WIDTH,
  type DisplayLike,
} from '../../src/shared/halo/geometry';
import { HALO_SIZE_PRESETS } from '../../src/shared/halo/sizes';
import type { IslandActivity, Rect } from '../../src/shared/halo/types';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(group: string, name: string, ok: boolean, detail: string): void {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${group}/${name}  ${detail}`);
  } else {
    fail += 1;
    failures.push(`${group}/${name}: ${detail}`);
    console.log(`  FAIL  ${group}/${name}  ${detail}`);
  }
}

const r = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

const NOTCH = { hasNotch: true, width: 244, height: 30, source: 'appkit' as const };

function geo(over: Partial<Parameters<typeof computeGeometry>[0]> = {}) {
  return computeGeometry({
    displayId: 1,
    displayBounds: r(0, 0, 3024, 1964),
    workArea: r(0, 38, 3024, 1926),
    scaleFactor: 2,
    ...over,
  });
}

console.log('\n=== GEOMETRY (HALO §150) ===');

{
  const g = geo();
  const cx = g.canvas.x + g.canvas.width / 2;
  check(
    'geometry',
    'centered_primary',
    Math.abs(cx - 1512) < 1,
    `canvas centre x=${cx.toFixed(1)} (display centre 1512)`,
  );
}

{
  // §16: y must come from display.bounds, NOT workArea — the island occupies the
  // menu-bar region on purpose. workArea.y is 38 here, so this proves it.
  const g = geo();
  check(
    'geometry',
    'top_uses_bounds_not_workArea',
    g.canvas.y === 0,
    `canvas.y=${g.canvas.y} (workArea.y=38, must be 0)`,
  );
}

{
  const g = geo({ displayBounds: r(3024, 0, 1920, 1080), displayId: 2 });
  check('geometry', 'secondary_right', g.displayId === 2 && g.canvas.x >= 3024, `canvas.x=${g.canvas.x}`);
}

{
  const g = geo({ displayBounds: r(-1920, 0, 1920, 1080) });
  check('geometry', 'secondary_left', g.canvas.x >= -1920 && g.canvas.x < 0, `canvas.x=${g.canvas.x}`);
}

{
  const g = geo({ displayBounds: r(0, -1080, 1920, 1080) });
  check('geometry', 'secondary_above', g.canvas.y === -1080, `canvas.y=${g.canvas.y}`);
}

{
  const g = geo({ displayBounds: r(0, 1080, 1920, 1080) });
  check('geometry', 'secondary_below', g.canvas.y === 1080, `canvas.y=${g.canvas.y}`);
}

{
  const g = geo({ displayBounds: r(-2560, -320, 1440, 900) });
  check(
    'geometry',
    'negative_coordinates',
    g.canvas.x >= -2560 && g.canvas.y === -320,
    `canvas=(${g.canvas.x},${g.canvas.y})`,
  );
}

{
  // Bounds arrive in DIP, so scaleFactor must not rescale them — HALO §29/§32.
  const a = geo({ scaleFactor: 1 });
  const b = geo({ scaleFactor: 2 });
  check(
    'geometry',
    'mixed_DPI_is_dip_stable',
    a.canvas.x === b.canvas.x && a.canvas.width === b.canvas.width,
    `x@1x=${a.canvas.x} x@2x=${b.canvas.x} width ${a.canvas.width}/${b.canvas.width}`,
  );
}

{
  const g = geo({ notch: NOTCH });
  const expected = compactWidthForNotch(NOTCH.width, 38);
  check(
    'geometry',
    'notch_split_wings',
    g.compactSize.width === expected,
    `2*38+244=${expected} actual=${g.compactSize.width}`,
  );
}

{
  const g = geo({ notch: { hasNotch: false, width: 0, height: 0, source: 'none' } });
  check(
    'geometry',
    'notchless_is_virtual_pill',
    // MEASURED from the Figma node tree: "Halo compact / Dark" INSTANCE is 198x32 at MEDIUM.
    // It was a fixed 232 at every size, which came from the OTHER spec (RESULT.md §1.2
    // "hard 232x40"). The pill now scales with the type preset: 182 / 198 / 227.
    g.compactSize.width === HALO_SIZE_PRESETS.medium.compactWidth,
    `compact width=${g.compactSize.width} (Figma medium pill = ${HALO_SIZE_PRESETS.medium.compactWidth})`,
  );
}

{
  const g = geo({ displayBounds: r(0, 0, 320, 640) });
  check(
    'geometry',
    'narrow_display_clamps',
    /* VERDICT 2026-10-08 supersedes section 9 for the canvas. The canvas is now the ACTIVE
     * PRESET'S EXPANDED SIZE, clamped to the display — so on a 320px display the Medium panel
     * (560) is clamped to 320-24 = 296 and the island is CLIPPED to fit the screen.
     *
     * The old assertion demanded 360 here, encoding section 9's `recommended_min_width` floor,
     * which existed to guarantee room AROUND a smaller panel. There is no longer a panel
     * smaller than the window, so that floor has nothing left to protect — and honouring it
     * would place the island 40px OFF-SCREEN, which is worse than clipping it.
     *
     * The invariant that actually matters is unchanged and still asserted: the canvas never
     * exceeds the display. */
    g.canvas.width === Math.min(560, 320 - 24),
    `canvas.width=${g.canvas.width} === min(preset 560, 320-24=296): the window is the panel, clamped to the display`,
  );
}

{
  const g = geo({ edge: 'left' });
  check('geometry', 'left_edge', g.canvas.x === 0 && g.edge === 'left', `canvas.x=${g.canvas.x}`);
}

{
  const g = geo({ edge: 'right', displayBounds: r(0, 0, 1920, 1080) });
  const right = g.canvas.x + g.canvas.width;
  check('geometry', 'right_edge', right === 1920, `canvas right=${right} (display 1920)`);
}

{
  // §49: the hot zone must NOT be the whole transparent canvas.
  const g = geo();
  check(
    'geometry',
    'hotzone_is_not_whole_canvas',
    g.hotZone.width < g.canvas.width && g.hotZone.height < g.canvas.height,
    `hot ${g.hotZone.width}x${g.hotZone.height} < canvas ${g.canvas.width}x${g.canvas.height}`,
  );
}

{
  const displays: DisplayLike[] = [
    { id: 1, bounds: r(0, 0, 3024, 1964), workArea: r(0, 38, 3024, 1926), scaleFactor: 2 },
    { id: 7, bounds: r(3024, 0, 1920, 1080), workArea: r(3024, 0, 1920, 1080), scaleFactor: 1 },
  ];
  const gone = resolveTargetDisplay(displays, 1, { type: 'display', displayId: 99 });
  check(
    'geometry',
    'vanished_display_falls_back_to_primary',
    gone?.id === 1,
    `saved display 99 -> resolved id ${gone?.id}`,
  );
}

console.log('\n=== HOVER (HALO §151) ===');

{
  const s = stepHover(initialHoverState(), { now: 0, inside: false, pinned: false });
  check('hover', 'outside_stays_closed', !s.state.hovered && s.intent === 'none', `hovered=${s.state.hovered}`);
}

{
  // §50: hovered flips on entry, so the assertion is that NO open intent is
  // emitted yet — the 110ms delay has not matured.
  const s = stepHover(initialHoverState(), { now: 0, inside: true, pinned: false });
  check(
    'hover',
    'enter_starts_intent',
    s.state.hovered && s.intent === 'none',
    `hovered=${s.state.hovered} intent=${s.intent} (delayed open)`,
  );
}

{
  // Regression guard for the defect the first run caught: a cursor that starts
  // outside must never put the machine into a hover that it cannot leave.
  let st = stepHover(initialHoverState(), { now: 5000, inside: false, pinned: false }).state;
  st = stepHover(st, { now: 20000, inside: false, pinned: false }).state;
  check(
    'hover',
    'never_entered_cannot_stuck_hover',
    !st.hovered && st.outsideSince === 0,
    `15s of outside samples -> hovered=${st.hovered}`,
  );
}

{
  let st: HoverState = initialHoverState();
  st = stepHover(st, { now: 0, inside: true, pinned: false }).state;
  const s = stepHover(st, { now: 50, inside: false, pinned: false });
  check(
    'hover',
    'exit_before_delay_cancels_open',
    s.intent === 'none' && s.state.intentSince === 0,
    `crossing filter cleared the pending intent at t=50 (open delay ${DEFAULT_HOVER_CONFIG.openDelayMs}ms)`,
  );
}

{
  let st: HoverState = initialHoverState();
  st = stepHover(st, { now: 1000, inside: true, pinned: false }).state;
  const s = stepHover(st, { now: 1110, inside: true, pinned: false });
  check('hover', 'intent_reaches_delay_opens', s.intent === 'open', `opened at 110ms`);
}

{
  let st: HoverState = { hovered: true, outsideSince: 0, intentSince: 0, inside: true, pinned: false };
  const s = stepHover(st, { now: 2000, inside: false, pinned: false });
  check(
    'hover',
    'first_exit_starts_grace',
    s.state.hovered && s.state.outsideSince === 2000 && s.intent === 'none',
    `grace started, still open`,
  );
}

{
  let st: HoverState = { hovered: true, outsideSince: 2000, intentSince: 0, inside: true, pinned: false };
  st = stepHover(st, { now: 2100, inside: false, pinned: false }).state;
  const s = stepHover(st, { now: 2150, inside: true, pinned: false });
  check(
    'hover',
    'inside_during_grace_keeps_open',
    s.state.hovered && s.state.outsideSince === 0 && s.intent !== 'close',
    're-entry cancels the pending close',
  );
}

{
  let st: HoverState = { hovered: true, outsideSince: 2000, intentSince: 0, inside: true, pinned: false };
  st = stepHover(st, { now: 2100, inside: false, pinned: false }).state;
  const s = stepHover(st, { now: 2280, inside: false, pinned: false });
  check('hover', 'grace_elapsed_closes', s.intent === 'close' && !s.state.hovered, `closed at +280ms`);
}

{
  const s = stepHover(
    { hovered: true, outsideSince: 0, intentSince: 0, inside: true, pinned: true },
    { now: 9999, inside: false, pinned: true },
  );
  check('hover', 'pinned_stays_open', s.state.hovered && s.intent === 'none', 'pin overrides cursor exit');
}

console.log('\n=== ROUTER (HALO §152) ===');

let tick = 1000;
function act(
  id: string,
  priority: number,
  over: Partial<IslandActivity> = {},
): IslandActivity {
  return {
    id,
    kind: 'custom',
    priority,
    persistent: false,
    pinned: false,
    createdAt: (tick += 10),
    updatedAt: tick,
    payload: null,
    ...over,
  };
}

{
  const rt = new ActivityRouter();
  rt.publish(act('stopwatch:default', 500, { persistent: true }), 1000);
  const created = rt.get('stopwatch:default')!.createdAt;
  tick += 500;
  rt.publish(act('stopwatch:default', 500, { persistent: true }), 1500);
  const after = rt.get('stopwatch:default')!;
  check(
    'router',
    'stable_id_update',
    rt.size === 1 && after.createdAt === created,
    `1 entry, createdAt preserved across update (${created})`,
  );
}

{
  const rt = new ActivityRouter();
  for (const v of [52, 53, 54, 55]) {
    rt.publish(act('hud:volume', 700, { replaceGroup: 'volume' }), 1000 + v);
  }
  check('router', 'replaceGroup_replaces', rt.size === 1, `52,53,54,55 -> ${rt.size} activity`);
}

{
  const rt = new ActivityRouter();
  rt.publish(act('stopwatch:default', 500, { persistent: true }), 1000);
  rt.publish(act('focus:s1', 600), 1100);
  check('router', 'higher_priority_wins', rt.resolveActive(null, 1200) === 'focus:s1', 'focus 600 beats stopwatch 500');
}

{
  const rt = new ActivityRouter();
  rt.publish(act('stopwatch:default', 500, { persistent: true }), 1000);
  rt.publish(act('transient:1', 800, { expiresAt: 1500 }), 1100);
  rt.resolveActive(null, 1200);
  rt.clearExpired(1600);
  check(
    'router',
    'persistent_survives_transient',
    rt.get('stopwatch:default') !== null && rt.get('transient:1') === null,
    'transient expired, persistent retained',
  );
}

{
  const rt = new ActivityRouter();
  rt.publish(act('t:1', 300, { expiresAt: 1000 }), 900);
  rt.publish(act('t:2', 300, { expiresAt: 1100 }), 900);
  rt.publish(act('t:3', 300, { expiresAt: 1200 }), 900);
  rt.publish(act('t:4', 300, { expiresAt: 1300 }), 900);
  check('router', 'queue_bounded', rt.size === 3, `4 transient published -> ${rt.size} retained (max 3)`);
}

{
  const rt = new ActivityRouter();
  rt.publish(act('pin:1', 100, { pinned: true }), 900);
  rt.publish(act('t:1', 900, { expiresAt: 1000 }), 900);
  rt.publish(act('t:2', 800, { expiresAt: 1000 }), 900);
  rt.publish(act('t:3', 700, { expiresAt: 1000 }), 900);
  rt.publish(act('t:4', 600, { expiresAt: 1000 }), 900);
  check('router', 'pinned_never_dropped', rt.get('pin:1') !== null, 'lowest-priority pinned survived the bound');
}

{
  const rt = new ActivityRouter();
  rt.publish(act('stopwatch:default', 500, { persistent: true }), 1000);
  const settled = rt.resolveActive(null, 1100);
  rt.publish(act('critical:1', 900), 1200);
  check(
    'router',
    'active_interaction_not_interrupted',
    rt.resolveActive(settled, 1300, { interactionLocked: true }) === settled,
    `locked -> kept ${settled} despite a 900-priority arrival`,
  );
}

{
  // The stickiness rule that stops HALO §213 "nervous" flicker.
  const rt = new ActivityRouter();
  rt.publish(act('a', 500, { persistent: true }), 1000);
  const first = rt.resolveActive(null, 1100);
  rt.publish(act('b', 500, { persistent: true }), 1200);
  check(
    'router',
    'equal_priority_does_not_flicker',
    rt.resolveActive(first, 1300) === first,
    `incumbent ${first} kept against equal-priority challenger`,
  );
}

{
  const rt = new ActivityRouter();
  rt.publish(act('flash', 800, { minimumDisplayMs: 1200, persistent: true }), 1000);
  rt.publish(act('other', 700, { persistent: true }), 1050);
  check(
    'router',
    'minimum_display_window_holds',
    rt.resolveActive(null, 1100) === 'flash',
    'flash keeps the surface inside its 1200ms minimum',
  );
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('halo core: ALL GREEN\n');