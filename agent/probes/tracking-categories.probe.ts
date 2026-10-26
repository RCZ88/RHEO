/**
 * tracking-categories.probe.ts
 *
 * Locks the two defects found in the live DB on 2026-10-20:
 *
 *   1. The daemon wrote category values the app does not know
 *      ('Development', 'Web', 'Music', 'Media', 'Social'), so those rows fell
 *      outside every category filter and chart.
 *   2. Substring keyword matching let the single-letter key `x` classify
 *      `xdg-desktop-portal-kde` as 'Social Media', and left `idea`,
 *      `kolourpaint`, `soffice.bin`, `dolphin` and `okular` Uncategorized.
 *
 * It tests the daemon categoriser directly, and audits the app's copy of the
 * map in src/main.ts so the two writers cannot drift apart silently.
 *
 * Run: npx tsx agent/probes/tracking-categories.probe.ts
 */
import { readFileSync } from 'node:fs';
import {
  CANONICAL_CATEGORIES,
  categorizeApp,
  categorizeDomain,
  loadCategories,
  normalizeCategory,
} from '../../rheo-tracker/src/categories';
import { canonicalAppName } from '../../src/shared/appIdentity';

loadCategories(true);

const canonical = new Set<string>(CANONICAL_CATEGORIES as readonly string[]);
let failures = 0;
let checks = 0;

function check(label: string, actual: string, expected: string): void {
  checks++;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

console.log('APP CATEGORIES (daemon)');
check('idea', categorizeApp('idea'), 'IDE');
check('jetbrains-idea', categorizeApp('jetbrains-idea'), 'IDE');
check('pycharm', categorizeApp('pycharm'), 'IDE');
// `konsole` and `rheo` have explicit overrides in this profile (both set to
// AI Tools), so the correct assertion is "the user override still wins" — not a
// hardcoded keyword result. Use apps without overrides for keyword coverage.
check('gnome-terminal', categorizeApp('gnome-terminal'), 'Productivity');
check('deskflow', categorizeApp('deskflow'), 'Productivity');
check('firefox', categorizeApp('firefox'), 'Browser');
check('chromium-browser', categorizeApp('chromium-browser'), 'Browser');
check('app.zen_browser.zen', categorizeApp('app.zen_browser.zen'), 'Browser');
check('kolourpaint', categorizeApp('kolourpaint'), 'Design');
check('soffice.bin', categorizeApp('soffice.bin'), 'Productivity');
check('dolphin', categorizeApp('dolphin'), 'Productivity');
check('okular', categorizeApp('okular'), 'Productivity');
check('obsidian', categorizeApp('obsidian'), 'Productivity');
check('kwrite', categorizeApp('kwrite'), 'Productivity');
check('xdg-desktop-portal-kde', categorizeApp('xdg-desktop-portal-kde'), 'Other');

// Override precedence is a contract, not an accident: Settings corrections must
// outrank both the keyword map and the auto-detected cache.
for (const app of ['konsole', 'rheo']) {
  const override = (() => {
    try {
      const p = `${process.env.HOME}/.config/RHEO/deskflow-categories.json`;
      return JSON.parse(readFileSync(p, 'utf8')).appCategoryMap?.[app];
    } catch {
      return undefined;
    }
  })();
  if (override) check(`${app} override wins`, categorizeApp(app), normalizeCategory(override));
}

console.log('\nDOMAIN CATEGORIES (daemon)');
check('youtube.com', categorizeDomain('youtube.com'), 'Entertainment');
check('www.youtube.com', categorizeDomain('www.youtube.com'), 'Entertainment');
check('open.spotify.com', categorizeDomain('open.spotify.com'), 'Entertainment');
check('github.com', categorizeDomain('github.com'), 'Developer Tools');
check('docs.github.com', categorizeDomain('docs.github.com'), 'Developer Tools');
check('twitter.com', categorizeDomain('twitter.com'), 'Social Media');
check('chatgpt.com', categorizeDomain('chatgpt.com'), 'AI Tools');
check('docs.google.com', categorizeDomain('docs.google.com'), 'Productivity');
// Parity with the app: unknown domains are 'Entertainment', not a third label.
check('unknown.example', categorizeDomain('unknown.example'), 'Entertainment');

console.log('\nCANONICAL VOCABULARY');
for (const [label, value] of [
  ['normalize(Development)', normalizeCategory('Development')],
  ['normalize(Web)', normalizeCategory('Web')],
  ['normalize(Music)', normalizeCategory('Music')],
  ['normalize(Media)', normalizeCategory('Media')],
  ['normalize(Social)', normalizeCategory('Social')],
] as const) {
  checks++;
  const ok = canonical.has(value);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} ${value}`);
}

// ---------------------------------------------------------------------------
// Source audit: the app's map must use the same vocabulary and contain the
// Linux fixes. (The app's categoriser lives in src/main.ts, which cannot be
// imported without booting Electron.)
// ---------------------------------------------------------------------------
console.log('\nAPP MAP PARITY (src/main.ts)');
const mainSrc = readFileSync('src/main.ts', 'utf8');

const appMapStart = mainSrc.indexOf('const DEFAULT_APP_CATEGORIES = {');
const appMapEnd = mainSrc.indexOf('};', appMapStart);
const appMap = mainSrc.slice(appMapStart, appMapEnd);
const mapValues = [...appMap.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
const badValues = [...new Set(mapValues.filter((v) => !canonical.has(v)))];
checks++;
if (badValues.length) failures++;
console.log(`  ${badValues.length === 0 ? 'ok  ' : 'FAIL'} app map values canonical       ${badValues.length ? badValues.join(', ') : 'all ' + mapValues.length}`);

for (const key of ['idea', 'jetbrains-idea', 'konsole', 'kolourpaint', 'soffice.bin', 'dolphin', 'okular', 'chromium-browser', 'app.zen_browser.zen']) {
  checks++;
  const ok = appMap.includes(`'${key}'`) || appMap.includes(`"${key}"`);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} app map has ${key}`);
}

checks++;
const usesBoundaryMatch = mainSrc.includes('appKeywordMatches(lower, keyword)');
if (!usesBoundaryMatch) failures++;
console.log(`  ${usesBoundaryMatch ? 'ok  ' : 'FAIL'} app categoriser uses boundary match`);

checks++;
const hasTransient = mainSrc.includes("'xdg-desktop-portal'");
if (!hasTransient) failures++;
console.log(`  ${hasTransient ? 'ok  ' : 'FAIL'} transient list filters xdg portals`);

// Same vocabulary as the Settings list the user actually picks from.
checks++;
const afkSrc = readFileSync('src/lib/afk.ts', 'utf8');
const afkBlock = afkSrc.slice(afkSrc.indexOf('export const ALL_CATEGORIES'), afkSrc.indexOf('] as const', afkSrc.indexOf('export const ALL_CATEGORIES')));
const afkCategories = [...afkBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const sameVocab = afkCategories.length === CANONICAL_CATEGORIES.length
  && afkCategories.every((c, i) => c === CANONICAL_CATEGORIES[i]);
if (!sameVocab) failures++;
console.log(`  ${sameVocab ? 'ok  ' : 'FAIL'} afk.ts vocabulary matches daemon   ${afkCategories.length} vs ${CANONICAL_CATEGORIES.length}`);

// ---------------------------------------------------------------------------
// App wiring audit for the AFK input-clock fix (src/main.ts + src/App.tsx).
// These files cannot be executed without Electron, so the wiring is asserted
// at the source level: a missing call here is exactly the bug returning.
// ---------------------------------------------------------------------------
console.log('\nAFK INPUT-CLOCK WIRING');
const appSrc = readFileSync('src/App.tsx', 'utf8');
for (const [label, needle] of [
  ['main auto-resume uses input clock', "const inputIdleMs = systemInputIdle_1.getSystemInputIdleMs();"],
  ['heartbeat publishes input clock', 'inputIdleAvailable: inputIdleMs !== null'],
  ['sleep detection prefers input clock', 'const inputIdleMs = systemInputIdle_1.getSystemInputIdleMs();'],
  ['auto-resume only for AFK pauses', 'if (!isTracking && trackingPausedByAfk)'],
  ['renderer prefers input clock', 'if (systemInputIdleAvailableRef.current)'],
  ['renderer return detector exists', "Device input detected while AFK"],
  ['renderer mirrors AFK pause to main', 'setAfkPaused?.(isIdle)'],
]) {
  checks++;
  const ok = mainSrc.includes(needle) || appSrc.includes(needle);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
}

// ---------------------------------------------------------------------------
// APP IDENTITY: the two writers must canonicalise the SAME Wayland app_id
// names to ONE stable identity, so one window cannot alternate between two
// "apps" (e.g. `jetbrains-idea` <-> `idea`) every time the foreground detector
// falls back. The daemon's shell filter must use substring matching (KDE
// reverse-DNS ids like `org.kde.polkit-kde-authentication-agent-1` carry
// suffixes the old exact Set lookup missed).
// ---------------------------------------------------------------------------
console.log('\nAPP IDENTITY (canonical aliases + shell filter)');
const identityCases: Array<[string, string]> = [
  ['jetbrains-idea', 'idea'],
  ['idea64', 'idea'],
  ['app.zen_browser.zen', 'zen'],
  ['zen_browser', 'zen'],
  ['org.kde.dolphin', 'dolphin'],
  ['org.kde.okular', 'okular'],
  ['org.kde.kwrite', 'kwrite'],
  // Names that are not aliases must pass through unchanged (case preserved).
  ['Visual Studio Code', 'Visual Studio Code'],
];
for (const [raw, expected] of identityCases) {
  checks++;
  const actual = canonicalAppName(raw);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} canonicalAppName(${JSON.stringify(raw)})  ${actual}${ok ? '' : ` (expected ${expected})`}`);
}
checks++;
if (canonicalAppName('') !== '') { failures++; }
console.log(`  ${canonicalAppName('') === '' ? 'ok  ' : 'FAIL'} canonicalAppName(empty) -> ''`);

checks++;
const sessionSrc = readFileSync('rheo-tracker/src/session.ts', 'utf8');
const needsSubstringShell = sessionSrc.includes('SHELL_APPS.some');
const needsAliasCall = sessionSrc.includes('canonicalAppName');
console.log(`  ${needsSubstringShell ? 'ok  ' : 'FAIL'} daemon shell filter uses substring set membership`);
console.log(`  ${needsAliasCall ? 'ok  ' : 'FAIL'} daemon normalises via canonicalAppName`);
checks += 2;
if (!needsSubstringShell) failures++;
if (!needsAliasCall) failures++;

checks++;
for (const needle of ['\'polkit\'', "'systemsettings'", "'plasma-systemmonitor'", "'ksecretd'"]) {
  checks++;
  const ok = sessionSrc.includes(needle);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} daemon shell list filters ${needle.replace(/'/g, '')}`);
}

console.log(`\nRESULT: ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} (${checks} checks)`);
process.exit(failures === 0 ? 0 : 1);
