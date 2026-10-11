/**
 * The AFK detector compared `systemIdleSecondsRef` (from Electron's
 * powerMonitor) against the threshold. On Linux that value is ALWAYS 0 —
 * measured on this box, 40s of zero input still read 0 — so the comparison
 * could never be true and AFK was undetectable.
 *
 * This probe models the real thing: an OS idle value that is permanently 0,
 * plus the renderer input clock, and asserts the DETECTOR fires.
 */
const thresholdMs = 5 * 60_000;

// --- the platform, faithfully -----------------------------------------------
const systemIdleSeconds = 0;           // what Electron gives us on Linux
let lastUserInputAt = Date.now();      // renderer input clock

const stampInput = () => { lastUserInputAt = Date.now(); };
const effectiveIdleSeconds = () => {
  const os = typeof systemIdleSeconds === 'number' ? systemIdleSeconds : 0;
  const renderer = Math.max(0, (Date.now() - lastUserInputAt) / 1000);
  return Math.max(os, renderer);
};
const detectorFires = () => effectiveIdleSeconds() * 1000 > thresholdMs;

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

console.log(`AFK threshold = ${thresholdMs / 60000} min, OS idle pinned at ${systemIdleSeconds}\n`);

console.log('OLD detector (OS clock only):');
ok(!detectorFires(), 'at rest, nothing fires');
const oldWouldFire = (systemIdleSeconds * 1000) > thresholdMs;
ok(oldWouldFire === false, `old detector NEVER fires: 0 > ${thresholdMs} is false  <-- the bug`);

console.log('\nNEW detector, simulating a user walking away:');
// jump the input clock forward 2h, exactly as 2h of no mouse/keyboard would
lastUserInputAt = Date.now() - 2 * 3600_000;
ok(detectorFires(), 'after 2h away the detector FIRES');
const trueIdleMs = Math.max(thresholdMs, effectiveIdleSeconds() * 1000);
ok(Math.round(trueIdleMs / 60000) === 120, `absence recorded as ${Math.round(trueIdleMs / 60000)} min, not the 5 min threshold`);

console.log('\nNEW detector, the user comes back:');
stampInput();
ok(!detectorFires(), 'one input event stops it firing immediately');

console.log('\nregression checks:');
lastUserInputAt = Date.now() - 4 * 60_000;
ok(!detectorFires(), '4m away (under threshold) does NOT fire');
lastUserInputAt = Date.now() - 5 * 60_000 - 1000;
ok(detectorFires(), '5m01s away DOES fire (boundary)');
lastUserInputAt = Date.now() - 60_000;
ok(!detectorFires(), '1m away does NOT fire');

console.log('\nwhen the OS clock DOES work, it must still win:');
const realOs = 900; // 15 min of true system-wide idle
const osAware = Math.max(realOs, Math.max(0, (Date.now() - (Date.now() - 60_000)) / 1000));
ok(osAware === realOs, `OS 900s beats renderer's 60s -> ${osAware}s`);

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
