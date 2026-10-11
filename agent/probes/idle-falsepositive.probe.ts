/**
 * The regression: after adding the renderer input clock, AFK fired CONSTANTLY
 * because the renderer cannot see input addressed to other windows.
 *
 * Scenarios the user actually described, run through the real decision logic.
 */
const thresholdMs = 5 * 60_000;
const osIdle = 0;                          // dead on Linux

let lastUserInputAt = Date.now();          // renderer clock
let foregroundQuiet = 0;                   // main's system-wide signal
let hasFocus = true;
let hidden = false;

const stampInput   = () => { lastUserInputAt = Date.now(); };
const stampTitle   = () => { foregroundQuiet = 0; };
const quietTick    = () => { foregroundQuiet += 1; };

const effectiveIdleSeconds = (): number => {
  if (osIdle > 0) return osIdle;
  if (hidden) return 0;
  const renderer = Math.max(0, (Date.now() - lastUserInputAt) / 1000);
  if (hasFocus) return renderer;
  return Math.min(renderer, foregroundQuiet);
};
const fires = () => effectiveIdleSeconds() * 1000 > thresholdMs;

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

console.log('--- 1. user works in DeskFlow, moving the mouse ---');
hasFocus = true; lastUserInputAt = Date.now() - 10 * 60_000;   // 10m since last input
stampInput();
ok(!fires(), 'moving the mouse  -> not AFK');

console.log('\n--- 2. THE FALSE POSITIVE: typing in another app for 10 minutes ---');
hasFocus = false; hidden = false;
lastUserInputAt = Date.now() - 10 * 60_000;                    // our window saw nothing
for (let i = 0; i < 10; i++) { quietTick(); if (i % 2 === 0) stampTitle(); } // title keeps changing
const idle = effectiveIdleSeconds();
console.log(`      renderer idle = 600s, foreground quiet = ${foregroundQuiet}s -> effective ${idle}s`);
ok(!fires(), 'typing elsewhere    -> NOT AFK  (was firing constantly)');

console.log('\n--- 3. user walks away from the desk ---');
hasFocus = false; lastUserInputAt = Date.now() - 20 * 60_000; foregroundQuiet = 0;
for (let i = 0; i < 20 * 60; i++) quietTick();                  // nothing changes for 20m
ok(fires(), `away 20m            -> AFK fires (quiet ${Math.round(foregroundQuiet/60)}min)`);

console.log('\n--- 4. window hidden (minimised / other workspace) ---');
hidden = true; hasFocus = false; lastUserInputAt = Date.now() - 30 * 60_000;
ok(!fires(), 'hidden 30m         -> not AFK (we cannot observe input)');

console.log('\n--- 5. short absence should never fire ---');
hasFocus = true; hidden = false; lastUserInputAt = Date.now() - 90_000;
ok(!fires(), '90s away           -> not AFK');

console.log('\n--- 6. real AFK while our window is focused and untouched ---');
lastUserInputAt = Date.now() - 45 * 60_000;
ok(fires(), '45m untouched      -> AFK fires');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
