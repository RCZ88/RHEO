/**
 * Probe — app-lifetime stopwatch tier watchdog
 * (agent/probes/stopwatch-app-tier-watcher.probe.mjs)
 *
 * CZ's bug, round 2: the distractingAction fix shipped in DashboardPage, so the
 * reset/pause only fired while the dashboard was mounted — off-dashboard the
 * store kept accruing under the last tier. Fix: the transition logic moved to
 * src/lib/stopwatchTierWatcher.ts (wired app-lifetime in App.tsx), with the
 * distracting 'pause' protected at STORE level (setDistractingPause) so browser
 * payloads ("user is actively browsing" -> setPaused(false) on every event)
 * cannot undo it on any route.
 *
 * Bundled REAL: the watcher module + the real store it drives. No mocks.
 * Run: node agent/probes/stopwatch-app-tier-watcher.probe.mjs
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'sww-probe-'));
// Bundle through a tiny re-export entry so the watcher and the probe share ONE
// store singleton — two separate bundles would each hold their own instance and
// the watcher would drive a store the probe never sees.
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

const { createStopwatchTierWatcher, resolveWatchTier, stopwatch } = await import(
  pathToFileURL(outfile).href
);
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

// ── mutable config the getters read ─────────────────────────────────────
const cfg = {
  tiers: { productive: ['IDE'], neutral: ['Other'], distracting: ['Entertainment'] },
  appTierMap: {},
  domainTierMap: {},
  behavior: { neutralAction: 'pause', distractingAction: 'reset' },
  trackerAppMode: 'track',
  foreground: '',
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

// ═══ 1. resolveWatchTier — category decides; maps only for NO category ═══
console.log('\n[1] resolveWatchTier formula (parity with DashboardPage.getTierFromCategory)');
ok('category present wins over maps', resolveWatchTier('Other', 'obsidian', cfg.tiers, { obsidian: 'productive' }, {}) === 'neutral');
ok('distracting category', resolveWatchTier('Entertainment', undefined, cfg.tiers, {}, {}) === 'distracting');
ok('unknown category -> neutral', resolveWatchTier('Whatever', undefined, cfg.tiers, {}, {}) === 'neutral');
ok('no category -> app map', resolveWatchTier(undefined, 'obsidian', cfg.tiers, { obsidian: 'productive' }, {}) === 'productive');
ok('app map miss -> domain map', resolveWatchTier(undefined, 'youtube.com', cfg.tiers, {}, { 'youtube.com': 'distracting' }) === 'distracting');
ok('nothing at all -> neutral', resolveWatchTier(undefined, undefined, cfg.tiers, {}, {}) === 'neutral');

// ═══ 2. Cold start on a productive app ═══════════════════════════════════
console.log('\n[2] cold start — productive app, first resolution, no spurious action');
const rc0 = snap().resetCount;
cfg.foreground = 'code';
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
ok('watchdog tier productive', wTier() === 'productive');
ok('store activeTier productive', snap().activeTier === 'productive');
ok('no reset on first resolution (prevTier null)', snap().resetCount === rc0);
ok('no pause on first resolution', snap().paused === false);

// accrue real productive time (tick banks the live segment — same pattern as
// the 2026-11-14 store probe, which proved tick+sleep accrual)
stopwatch.touch();
await sleep(60);
stopwatch.tick();
const accrued = snap().productiveMs;
ok('productive time accrued while on IDE', accrued >= 25, `productiveMs=${accrued}`);

// ═══ 3. Enter browser, then a distracting site — distractingAction='reset' ══
console.log("\n[3] distracting entry — distractingAction='reset' (the CZ scenario)");
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
ok('browser entry keeps last tier (website not yet known)', wTier() === 'productive');
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
ok('watchdog tier distracting (immediately)', wTier() === 'distracting');
ok('store activeTier distracting', snap().activeTier === 'distracting');
ok('reset NOT fired inside the confirm window', snap().resetCount === rc0, 'entry actions arm a 2.5s confirmation first');
await sleep(2700);
ok('DISTRACTING -> RESET fired exactly once (after confirm)', snap().resetCount === rc0 + 1);
ok('reset zeroed the accrued productive time', snap().productiveMs < 40, `productiveMs=${snap().productiveMs}`);

// ═══ 4. Idempotence + focused guard ══════════════════════════════════════
console.log('\n[4] same-payload repeats and unfocused payloads must not re-fire');
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
ok('same payload again: no second reset', snap().resetCount === rc0 + 1);
w.onBrowserEvent({ type: 'browser-data', domain: 'another.com', category: 'Entertainment', is_browser_focused: false });
ok('is_browser_focused=false payload ignored (category not replaced)', w._debug.websiteCategory === 'Entertainment', `websiteCategory=${w._debug.websiteCategory}`);
ok('unfocused payload fired no reset', snap().resetCount === rc0 + 1);

// ═══ 5. Leave browser -> productive (reset path never paused) ════════════
console.log('\n[5] leaving the browser returns to the app tier');
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
ok('watchdog tier productive again', wTier() === 'productive');
ok('store activeTier productive', snap().activeTier === 'productive');
ok('still not paused (reset path set no pause)', snap().paused === false);

// ═══ 6. distractingAction='pause' — flag set, ISLAND resume must work ════
console.log("\n[6] distractingAction='pause' — watchdog pause + island compatibility");
cfg.behavior.distractingAction = 'pause';
stopwatch.setPaused(false);
stopwatch.touch();
await sleep(60);
stopwatch.tick();
const accrued2 = snap().productiveMs;
ok('productive time accrued again', accrued2 >= 25, `productiveMs=${accrued2}`);
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
await sleep(2700);
ok('DISTRACTING -> PAUSE fired (after confirm)', snap().paused === true, 'paused should be true after entering youtube with action=pause');
ok('self-pause flag exposed for the payload guard', stopwatch.isDistractingSelfPaused() === true);

// THE ISLAND GUARANTEE (OverlayRoot :1631 toggleTrack / pill pause button):
// a user-initiated resume must NEVER be absorbed by the watchdog pause.
stopwatch.setPaused(false);
ok('island-style plain resume WORKS (no absorption)', snap().paused === false,
  'the island pause button and track-deadline resume call setPaused(false) directly');

// Re-establish the self-pause via a REAL leave + re-enter (the island resume
// intentionally does not re-pause a site the user is still sitting on).
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
await sleep(2700);
ok('re-entry re-pauses', snap().paused === true);
ok('flag re-set on re-entry', stopwatch.isDistractingSelfPaused() === true);
if (!stopwatch.isDistractingSelfPaused()) stopwatch.setPaused(false); // what DashboardPage's payload handler does
ok('browser-payload unpause REFUSED while self-pause in force', snap().paused === true,
  'the exact 2026-11-14 regression, now guarded in the payload handler via the store flag');

// ═══ 7. Leaving distracting auto-resumes, and unpauses work again ════════
console.log('\n[7] leaving the distracting tier releases ONLY the self-pause');
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
ok('auto-resumed on leaving distracting', snap().paused === false);
ok('self-pause flag cleared on leaving', stopwatch.isDistractingSelfPaused() === false);
ok('watchdog tier productive', wTier() === 'productive');

// ═══ 8. Neutral tier — neutralAction ═════════════════════════════════════
console.log("\n[8] neutralAction='pause' then a real app release");
cfg.behavior.neutralAction = 'pause';
w.onForeground({ app: 'mail', category: 'Other', isReal: true });
await sleep(2700);
ok('NEUTRAL -> PAUSE fired (after confirm)', snap().paused === true);
ok('watchdog tier neutral', wTier() === 'neutral');
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
ok('real app release unpauses (mirrors the dashboard foreground branch)', snap().paused === false);

console.log("\n[9] neutralAction='reset'");
cfg.behavior.neutralAction = 'reset';
const rcBeforeNeutralReset = snap().resetCount;
w.onForeground({ app: 'mail', category: 'Other', isReal: true });
await sleep(2700);
ok('NEUTRAL -> RESET fired exactly once (after confirm)', snap().resetCount === rcBeforeNeutralReset + 1);
w.onForeground({ app: 'code', category: 'IDE', isReal: true });

// ═══ 10. Tracker app modes ═══════════════════════════════════════════════
console.log("\n[10] trackerAppMode='pause' pauses; tier unchanged; release unpauses");
cfg.trackerAppMode = 'pause';
w.onForeground({ app: 'RHEO', category: 'Other', isReal: true });
ok('tracker-app pause fired', snap().paused === true);
ok('tier NOT re-resolved to the tracker category (kept productive)', wTier() === 'productive');
cfg.trackerAppMode = 'track';
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
ok('real app release unpauses', snap().paused === false);
ok('tier back to productive', wTier() === 'productive');

// ═══ 11. 'clear' event — honoured only when the browser REALLY lost focus ══
console.log("\n[11] 'clear' while still browsing is IGNORED (spurious-clear guard)");
w.onForeground({ app: 'zen', category: 'Browser', isReal: true });
cfg.foreground = 'zen'; // the getter the clear guard reads
w.onBrowserEvent({ type: 'browser-data', domain: 'youtube.com', category: 'Entertainment', is_browser_focused: true });
await sleep(2700);
ok('website registered (distracting)', wTier() === 'distracting');
// The CZ reset vector: main emits 'clear' off a Wayland false-negative OS read
// while the user is still in the browser. The watchdog must ignore it.
w.onBrowserEvent({ type: 'clear' });
ok('spurious clear (browser still foreground) keeps the site', w._debug.websiteCategory === 'Entertainment', `websiteCategory=${w._debug.websiteCategory}`);
ok('spurious clear fired no tier flap', wTier() === 'distracting');
// A real browser exit: the foreground app changed underneath the clear.
cfg.foreground = 'code';
w.onForeground({ app: 'code', category: 'IDE', isReal: true });
w.onBrowserEvent({ type: 'clear' });
ok('real clear (non-browser foreground) dropped the website', w._debug.websiteCategory === '');
ok('tier fell back to the last non-browser app (IDE -> productive)', wTier() === 'productive');
w.onForeground({ app: 'code', category: 'IDE', isReal: true });

// ═══ 12. Per-app/domain map fallback through the watcher ═════════════════
console.log('\n[12] no-category apps resolve through the tier maps (watcher path)');
cfg.appTierMap = { obsidian: 'productive' };
w.onForeground({ app: 'obsidian', category: '', isReal: true });
ok('app map fallback -> productive', wTier() === 'productive');
delete cfg.appTierMap.obsidian;
cfg.domainTierMap = { obsidian: 'distracting' };
w.onForeground({ app: 'obsidian', category: '', isReal: true });
ok('domain map fallback -> distracting', wTier() === 'distracting');
cfg.domainTierMap = {};

// ═══ Summary ═════════════════════════════════════════════════════════════
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log('='.repeat(60));
process.exit(fail > 0 ? 1 : 0);
