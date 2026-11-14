/**
 * Probe — watchdog tier-flap guard (the CZ "stopwatch zeroes itself" fix)
 * (agent/probes/stopwatch-watchdog-flap-guard.probe.mjs)
 *
 * CZ's bug, round 3: the island stopwatch kept going back to 0 "on its own",
 * with no app switch. Chain: the app-lifetime watchdog fires
 * distractingAction:'reset' (the DEFAULT) on every ENTRY into a distracting
 * tier, and the tier can FLAP with no user action — main emits 'clear'
 * browser-tracking events off Wayland false-negative foreground reads and
 * cached-poll gaps while the user is still sitting in the browser (main.ts's
 * own comments document both failure modes), so the watcher fell back to the
 * last non-browser app's tier and the next accepted payload flipped back.
 *
 * Fix under test (src/lib/stopwatchTierWatcher.ts):
 *   1. a 'clear' while the browser is STILL the confirmed foreground is ignored;
 *   2. destructive entry actions arm a 2.5s confirmation — any tier change in
 *      between cancels them, so a flap can never fire a reset.
 *
 * Bundled REAL: the watcher module + the real store it drives. No mocks.
 * Run: node agent/probes/stopwatch-watchdog-flap-guard.probe.mjs
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'swf-probe-'));
const entry = join(outdir, 'entry.ts');
writeFileSync(entry, [
  `export * from '${join(process.cwd(), 'src/lib/stopwatchTierWatcher.ts')}';`,
  `export { stopwatch } from '${join(process.cwd(), 'src/lib/stopwatchStore.ts')}';`,
  '',
].join('\n'));
const outfile = join(outdir, 'watcher.bundle.mjs');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});

const { createStopwatchTierWatcher, stopwatch } = await import(pathToFileURL(outfile).href);
if (!stopwatch || !createStopwatchTierWatcher) {
  console.error('FATAL: bundle did not expose the watcher and/or the store singleton');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};

const cfg = {
  tiers: { productive: ['IDE'], neutral: ['Other'], distracting: ['Entertainment'] },
  appTierMap: {},
  domainTierMap: {},
  behavior: { neutralAction: 'pause', distractingAction: 'reset' },
  trackerAppMode: 'track',
  foreground: 'code',
  browsers: ['zen'],
};

const w = createStopwatchTierWatcher({
  getTiers: () => cfg.tiers,
  getAppTierMap: () => cfg.appTierMap,
  getDomainTierMap: () => cfg.domainTierMap,
  getTimerBehavior: () => cfg.behavior,
  getTrackerAppMode: () => cfg.trackerAppMode,
  getForegroundApp: () => cfg.foreground,
  getTrackingBrowsers: () => cfg.browsers,
  isBrowserApp: (app, cands) => cands.some((c) => app.toLowerCase().includes(c.toLowerCase())),
});

const snap = () => stopwatch.getSnapshot();
const wTier = () => w._debug.tier;

// Cold start: productive app, accrue some real time worth protecting.
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
stopwatch.touch();
await sleep(120);
stopwatch.tick();
const banked = snap().productiveMs;
ok('productive time banked on IDE', banked >= 40, `productiveMs=${banked}`);

// ═══ 1. THE CZ OSCILLATION — spurious clears while still browsing ════════
console.log('\n[1] oscillation: accepted payload <-> spurious clear, user never leaves zen');
cfg.foreground = 'zen';
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
const rc0 = snap().resetCount;
const payload = () => w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
const spuriousClear = () => w.onBrowserEvent({ type: 'clear' });
// 4 full flap cycles, spaced INSIDE the confirm window (the real cadence: the
// 2s poll glitches, the next extension payload follows within seconds).
for (let i = 0; i < 4; i++) {
  payload();
  spuriousClear();
  spuriousClear();
  payload();
}
ok('tier stayed distracting throughout (clear ignored)', wTier() === 'distracting', `tier=${wTier()}`);
ok('site category survived every spurious clear', w._debug.websiteCategory === 'Entertainment', `websiteCategory=${w._debug.websiteCategory}`);
ok('no reset DURING the oscillation (inside the confirm window)', snap().resetCount === rc0, `resetCount ${rc0} -> ${snap().resetCount}`);
ok('the banked productive time was NOT zeroed during the flap', snap().productiveMs >= 40, `productiveMs=${snap().productiveMs}`);
// The user then stays on the site: the entry is real and stable, so the
// confirmed reset fires exactly once — that is the designed behaviour.
await sleep(2700);
ok('stable entry afterwards resets exactly once', snap().resetCount === rc0 + 1, `resetCount ${rc0} -> ${snap().resetCount}`);

// ═══ 2. Empty-category flap — flips must CANCEL each other's arms ═══════
console.log('\n[2] uncategorized payload flap (category "" falls back) — flips cancel arms');
const rc1 = snap().resetCount;
// Space the flips ~300ms apart: each entry into distracting arms a reset, and
// the NEXT flip (productive fallback) must cancel it before the window ends.
for (let i = 0; i < 4; i++) {
  w.onBrowserEvent({ type: 'browser-data', domain: 'newtab', category: '', is_browser_focused: true });
  await sleep(300);
  w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
  await sleep(300);
}
// End on the uncategorized state so nothing is armed at window expiry.
w.onBrowserEvent({ type: 'browser-data', domain: 'newtab', category: '', is_browser_focused: true });
await sleep(2700);
ok('empty-category flap fired no reset', snap().resetCount === rc1, `resetCount ${rc1} -> ${snap().resetCount}`);

// ═══ 3. A REAL entry that reverses quickly must not reset ═══════════════
console.log('\n[3] real distracting entry reversed inside the confirm window');
// Re-bank time: the confirmed reset in [1] zeroed the accrual by design.
stopwatch.touch();
await sleep(120);
stopwatch.tick();
const banked2 = snap().productiveMs;
ok('time re-banked', banked2 >= 40, `productiveMs=${banked2}`);
const rc2 = snap().resetCount;
cfg.foreground = 'code';
w.onForeground({ app: 'code', category: 'IDE', isReal: true }); // real exit (clears site)
cfg.foreground = 'zen';
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
ok('tier distracting after a real entry', wTier() === 'distracting');
ok('reset not fired inside the window', snap().resetCount === rc2);
// user navigates away within the window
w.onBrowserEvent({ type: 'browser-data', domain: 'docs.dev', category: 'IDE', is_browser_focused: true });
ok('tier productive after quick reverse', wTier() === 'productive');
await sleep(2700);
ok('cancelled entry fired NO reset', snap().resetCount === rc2, `resetCount ${rc2} -> ${snap().resetCount}`);
ok('the re-banked time still intact', snap().productiveMs >= 40, `productiveMs=${snap().productiveMs}`);

// ═══ 4. A REAL, STABLE entry still resets — exactly once ════════════════
console.log('\n[4] real stable distracting entry resets after confirmation');
const rc3 = snap().resetCount;
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
ok('tier distracting', wTier() === 'distracting');
ok('reset still pending inside the window', snap().resetCount === rc3);
await sleep(2700);
ok('confirmed entry reset EXACTLY once', snap().resetCount === rc3 + 1, `resetCount ${rc3} -> ${snap().resetCount}`);
ok('the reset zeroed the accrual (real user action honoured)', snap().productiveMs < 40, `productiveMs=${snap().productiveMs}`);

// ═══ Summary ═════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log('='.repeat(60));
process.exit(fail > 0 ? 1 : 0);
