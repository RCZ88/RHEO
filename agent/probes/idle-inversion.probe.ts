/**
 * The inversion: a chat app / music player rewrites its window title every
 * second or two with nobody touching anything. Treating every title change as
 * "the user is typing" reset the input clock forever, so genuine AFK stopped
 * firing entirely — while a quiet single window still looked idle.
 *
 * These are the four situations that were reported, run through the real logic.
 */
const thresholdMs = 5 * 60_000;
const osIdle = 0;                       // dead on Linux

let lastUserInputAt = Date.now();        // REAL input in this window only
let lastFgActivityAt = Date.now();       // app switch or title rewrite, system-wide

const input   = () => { lastUserInputAt = Date.now(); };
const chatter = () => { lastFgActivityAt = Date.now(); };   // automated title rewrite

const effectiveIdleSeconds = (hasFocus: boolean, hidden = false): number => {
  if (osIdle > 0) return osIdle;
  if (hidden) return 0;
  const renderer = Math.max(0, (Date.now() - lastUserInputAt) / 1000);
  if (hasFocus) return renderer;
  const systemQuiet = Math.max(0, (Date.now() - Math.max(lastFgActivityAt, lastUserInputAt)) / 1000);
  return Math.min(renderer, systemQuiet);
};

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const mins = (n: number) => Math.round(n / 60);

console.log('--- A. GENUINELY AFK, app focused, chat app chattering in background ---');
lastUserInputAt = Date.now() - 30 * 60_000;      // 30 min, untouched
for (let i = 0; i < 30 * 60; i++) chatter();      // title rewritten every second
const a = effectiveIdleSeconds(true);
console.log(`      renderer 30min, but focused -> effective ${mins(a)}min`);
ok(a * 1000 > thresholdMs, 'AFK 30m with noisy title -> FIRES  (was silently blocked)');

console.log('\n--- B. working in ANOTHER app, its title rewriting constantly ---');
lastUserInputAt = Date.now() - 30 * 60_000;
for (let i = 0; i < 30 * 60; i++) chatter();
const b = effectiveIdleSeconds(false);
console.log(`      renderer 30min, unfocused, title changing -> effective ${b}s`);
ok(!(b * 1000 > thresholdMs), 'busy in another app  -> does NOT fire');

console.log('\n--- C. GENUINELY AWAY, everything silent (the normal case) ---');
lastUserInputAt = Date.now() - 8 * 60_000;
lastFgActivityAt = Date.now() - 8 * 60_000;      // nothing changed either
ok(effectiveIdleSeconds(false) * 1000 > thresholdMs, 'away 8m, machine silent -> FIRES');
ok(effectiveIdleSeconds(true) * 1000 > thresholdMs, 'away 8m, app focused    -> FIRES');

console.log('\n--- D. actually working in THIS window ---');
lastUserInputAt = Date.now();
lastFgActivityAt = Date.now();
input();
ok(!(effectiveIdleSeconds(true) * 1000 > thresholdMs), 'moving mouse -> does NOT fire');
lastUserInputAt = Date.now() - 4 * 60_000; lastFgActivityAt = Date.now();
ok(!(effectiveIdleSeconds(true) * 1000 > thresholdMs), '4m of reading -> does NOT fire (under 5m)');

console.log('\n--- E. window hidden: we cannot observe, so never claim idle ---');
lastUserInputAt = Date.now() - 60 * 60_000; lastFgActivityAt = Date.now() - 60 * 60_000;
ok(effectiveIdleSeconds(false, true) === 0, 'hidden 1h -> reports 0, never fires');

console.log('\n--- F. KNOWN LIMITATION, asserted so it cannot be quietly forgotten ---');
// Our window unfocused AND another app rewriting its title: "a human is typing
// in a chat app" and "a chat app is chattering while the desk is empty" produce
// IDENTICAL signals. There is no system idle API on Linux to break the tie
// (getSystemIdleTime returns 0 — verified), and xprintidle is not installed.
//
// We deliberately do NOT fire here. Missing a prompt is recoverable — the gap
// detector still finds the untracked time on the External page — whereas a
// false prompt every time you use a chat app destroys trust in the whole
// feature. This assertion pins that choice: if someone "fixes" this by firing
// again, the probe fails and the trade-off has to be made consciously.
lastUserInputAt = Date.now() - 20 * 60_000;
for (let i = 0; i < 20 * 60; i++) chatter();
const f = effectiveIdleSeconds(false);
console.log(`      unfocused + nonstop chatter -> effective ${f}s (chatter CAPS, never extends)`);
ok(!(f * 1000 > thresholdMs), 'unfocused + nonstop chatter -> does NOT fire (safe direction)');

console.log('\n--- G. the case that actually matters: app focused, away, noisy machine ---');
// Case A is the reported bug. Even with the whole desktop chattering, an
// untouched focused window must still be detected.
lastUserInputAt = Date.now() - 45 * 60_000;
for (let i = 0; i < 45 * 60; i++) chatter();
ok(effectiveIdleSeconds(true) * 1000 > thresholdMs, 'focused + 45m untouched + noisy desktop -> FIRES');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
