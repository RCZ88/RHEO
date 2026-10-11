/**
 * Probe the AFK prefs module's new normalisation + helpers.
 * No DOM: we stub localStorage so it runs in plain node.
 */
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
};
(globalThis as any).window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  deskflowAPI: undefined,
};
(globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };

import {
  AFK_DEFAULTS, AFK_DEFAULT_THRESHOLD_MINUTES, getAfkPrefs, setAfkPrefs, afkThresholdMs,
  shouldPromptForAbsence, isPassiveCategory, defaultsToNotAfk,
} from '../../src/lib/afk';

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

console.log('fresh install gets every key, including the 4 that used to be hardcoded:');
const fresh = getAfkPrefs();
console.log('  ' + JSON.stringify(fresh));
ok(fresh.minPromptSeconds === 60, 'minPromptSeconds defaults to 60');
ok(fresh.notAfkBelowMinutes === 15, 'notAfkBelowMinutes defaults to 15');
ok(fresh.passiveCategories.join() === 'Entertainment,Gaming', 'passiveCategories defaults to Entertainment,Gaming');
ok(fresh.thresholdMinutes === 5 && fresh.action === 'pause-only' && fresh.enabled === true, 'original 3 prefs intact');

console.log('\nbackwards compat — a prefs blob written by an OLD build (3 keys only):');
store['deskflow-afk-prefs'] = JSON.stringify({ thresholdMinutes: 12, action: 'reset-streak', enabled: false });
const legacy = getAfkPrefs();
ok(legacy.thresholdMinutes === 12 && legacy.action === 'reset-streak' && legacy.enabled === false, 'old keys still read');
ok(legacy.minPromptSeconds === 60 && legacy.notAfkBelowMinutes === 15, 'missing new keys fall back to the old hardcoded values');
ok(legacy.passiveCategories.length === 2, 'missing passiveCategories falls back');

console.log('\nhostile / corrupt values are clamped, not trusted:');
store['deskflow-afk-prefs'] = JSON.stringify({
  thresholdMinutes: 9999, minPromptSeconds: -50, notAfkBelowMinutes: 1e9,
  passiveCategories: ['Entertainment', 'NOT_A_CATEGORY', 42, 'Gaming', 'Gaming', ''],
  action: 'drop-database',
});
const clamped = getAfkPrefs();
ok(clamped.thresholdMinutes === 60, `thresholdMinutes 9999 -> 60 (got ${clamped.thresholdMinutes})`);
ok(clamped.minPromptSeconds === 0, `minPromptSeconds -50 -> 0 (got ${clamped.minPromptSeconds})`);
ok(clamped.notAfkBelowMinutes === 120, `notAfkBelowMinutes 1e9 -> 120 (got ${clamped.notAfkBelowMinutes})`);
ok(clamped.action === 'pause-only', `unknown action -> pause-only (got ${clamped.action})`);
ok(clamped.passiveCategories.join() === 'Entertainment,Gaming', `unknown/duplicate categories dropped (got ${clamped.passiveCategories.join()})`);

console.log('\nthe prompt gate now honours the setting:');
setAfkPrefs({ minPromptSeconds: 300 });
ok(!shouldPromptForAbsence(120), '2m absence NOT prompted when floor is 5m');
ok(shouldPromptForAbsence(360), '6m absence prompted when floor is 5m');
setAfkPrefs({ minPromptSeconds: 0 });
ok(shouldPromptForAbsence(5), 'floor 0 asks about a 5s absence');
setAfkPrefs({ enabled: false });
ok(!shouldPromptForAbsence(99999), 'master switch off suppresses everything');
setAfkPrefs({ enabled: true });

console.log('\npassive categories are the user\'s list, not a constant:');
setAfkPrefs({ passiveCategories: ['Entertainment', 'Gaming'] });
ok(isPassiveCategory('Entertainment'), 'Entertainment is passive by default');
ok(!isPassiveCategory('IDE'), 'IDE is not passive');
setAfkPrefs({ passiveCategories: ['IDE'] });
ok(isPassiveCategory('IDE'), 'user can make IDE passive');
ok(!isPassiveCategory('Gaming'), 'and drop Gaming');
ok(!isPassiveCategory(null), 'null category is never passive');

console.log('\nthe "I wasn\'t AFK" default follows the slider:');
setAfkPrefs({ notAfkBelowMinutes: 15 });
ok(defaultsToNotAfk(600), '10m defaults when bound is 15m');
ok(!defaultsToNotAfk(1200), '20m does not default when bound is 15m');
setAfkPrefs({ notAfkBelowMinutes: 60 });
ok(defaultsToNotAfk(3000), '50m defaults when bound is 60m');

console.log('\nTHE 5-MINUTE CONTRACT (locked):');
ok(AFK_DEFAULT_THRESHOLD_MINUTES === 5, `default threshold is 5 minutes (got ${AFK_DEFAULT_THRESHOLD_MINUTES})`);
ok(AFK_DEFAULTS.thresholdMinutes === 5, 'AFK_DEFAULTS.thresholdMinutes is 5');
// Clear storage first: earlier in this probe we deliberately stored a hostile
// thresholdMinutes, so this has to be a genuinely fresh profile.
store['deskflow-afk-prefs'] = JSON.stringify({});
ok(getAfkPrefs().thresholdMinutes === 5, 'a fresh profile starts at 5');
delete store['deskflow-afk-prefs'];
ok(getAfkPrefs().thresholdMinutes === 5, 'a profile with NO stored prefs starts at 5');
ok(afkThresholdMs({ ...AFK_DEFAULTS, enabled: true }) === 300000, '5 minutes converts to 300000ms');
ok(afkThresholdMs({ ...AFK_DEFAULTS, enabled: false }) === Infinity, 'disabled = never idle');
// The detector's own test is `idleSec * 1000 > idleMs` — assert that boundary
// directly so "only after 5 minutes" cannot quietly become "after 1".
const fires = (idleSec: number, ms: number) => idleSec * 1000 > ms;
const T = afkThresholdMs({ ...AFK_DEFAULTS, enabled: true });
ok(!fires(299, T), '4m59s away  -> NOT afk');
ok(fires(301, T), '5m01s away  -> afk');
ok(!fires(60, T), '1m away     -> NOT afk');
ok(!fires(600, Infinity), 'even 10m away does nothing while disabled');

console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
