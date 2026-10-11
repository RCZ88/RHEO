/**
 * "AFK works in other apps but not in RHEO itself."
 *
 * Cause: the presence listeners treated two events as human input that a LIVE
 * app generates on its own:
 *   - `scroll`  fires for programmatic scrolling / auto-scroll / scroll anchoring
 *   - `mousemove` fires when the element under a STATIONARY cursor is replaced,
 *               which a dashboard does constantly (ticking stopwatch, streaming
 *               logs, repainting charts)
 * Both reset the idle clock, so the absence never reached the threshold — but
 * only inside RHEO, because that is the only DOM repainting under the cursor.
 */

const thresholdMs = 5 * 60_000;
const POINTER_MOVE_MIN_PX = 3;

// Fake clock: a tight loop does not advance Date.now(), so without this the
// probe cannot tell "kept stamping" from "stopped stamping" — both read 0m.
let NOW = 1_000_000;
const now = () => NOW;
const advance = (seconds: number) => { NOW += seconds * 1000; };

let lastInputAt = now();
let lastPointer: { x: number; y: number } | null = null;

const stamp = () => { lastInputAt = now(); };
const onMouseMove = (x: number, y: number) => {
  const last = lastPointer;
  if (last && Math.abs(x - last.x) < POINTER_MOVE_MIN_PX && Math.abs(y - last.y) < POINTER_MOVE_MIN_PX) return;
  lastPointer = { x, y };
  stamp();
};
const onScroll = () => stamp();          // the OLD behaviour
const onKey = () => stamp();
const onWheel = () => stamp();

const idleSec = () => Math.max(0, (now() - lastInputAt) / 1000);
const fires = () => idleSec() * 1000 > thresholdMs;

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const mins = (n: number) => Math.round(n / 60);

console.log('--- OLD behaviour: live RHEO window, user walks away ---');
lastInputAt = now() - 20 * 60_000; lastPointer = null;
for (let t = 0; t < 20 * 60; t++) {
  advance(1);
  onScroll();                                        // a list auto-scrolled
  onMouseMove(500, 400);                            // same pixel, DOM swapped
}
console.log(`      after 20m of phantom events: idle = ${mins(idleSec())}m`);
ok(!fires(), 'OLD: phantom events mask a real 20m absence  <-- the bug');

console.log('\n--- NEW behaviour: same live window, same 20m, user still away ---');
lastInputAt = now() - 20 * 60_000; lastPointer = null;
for (let t = 0; t < 20 * 60; t++) {
  advance(1);
  // scroll is no longer listened to at all
  onMouseMove(500, 400);                            // stationary: ignored now
}
console.log(`      after 20m: idle = ${mins(idleSec())}m`);
ok(fires(), 'NEW: a real 20m absence on RHEO now FIRES');

console.log('\n--- and a real person is still detected instantly ---');
lastInputAt = now();
onMouseMove(500, 400);
ok(!fires(), 'after one real mouse move -> not AFK');
lastInputAt = now() - 6 * 60_000;
onMouseMove(520, 430);                               // 20px+ = genuine movement
ok(!fires(), 'genuine movement after 6m away -> immediately not AFK');
onKey();
ok(!fires(), 'a keystroke -> not AFK');
lastInputAt = now() - 6 * 60_000;
onWheel();
ok(!fires(), 'a scroll WHEEL gesture -> not AFK');

console.log('\n--- small jitter is still not presence, real movement is ---');
lastInputAt = now() - 6 * 60_000; lastPointer = { x: 500, y: 400 };
onMouseMove(501, 401);                              // 1px
ok(fires(), '1px jitter does NOT count as presence');
onMouseMove(540, 400);                              // 40px
ok(!fires(), '40px movement DOES count');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
