// Probe: the daemon's browser ingest after the 600-hour fix.
// Runs the REAL bundled ingest() from rheo-tracker/src/browserServer.ts against
// a scratch DB (RHEO_TRACKER_DB), replaying the exact payload sequences the
// extension sends. Prints numbers; exits non-zero on any failed assertion.
//
// Run:  RHEO_TRACKER_DB=/tmp/opencode/probe-daemon/deskflow-data.db node agent/probes/tracking-daemon-browser.probe.mjs

import { DatabaseSync } from 'node:sqlite';
import { rmSync, mkdirSync } from 'node:fs';
import assert from 'node:assert';

const DB = process.env.RHEO_TRACKER_DB;
if (!DB || !DB.includes('probe')) {
  console.error('REFUSING: set RHEO_TRACKER_DB to a scratch path containing "probe"');
  process.exit(2);
}
rmSync(DB, { force: true });
mkdirSync(DB.slice(0, DB.lastIndexOf('/')), { recursive: true });

const { ingest } = await import('/tmp/opencode/probe-daemon-ingest.mjs');

// ── Schema: the columns the daemon touches, matching the live DB ────────────
const db = new DatabaseSync(DB);
db.exec(`
  CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL, app TEXT NOT NULL, category TEXT,
    duration_ms INTEGER NOT NULL, title TEXT, project TEXT,
    url TEXT, domain TEXT, tab_id INTEGER,
    is_browser_tracking INTEGER DEFAULT 0,
    platform TEXT DEFAULT 'linux', source TEXT DEFAULT 'auto',
    profile_id TEXT, browser_name TEXT
  );
  CREATE TABLE browser_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, domain TEXT NOT NULL, category TEXT,
    total_sec INTEGER DEFAULT 0, session_count INTEGER DEFAULT 0,
    platform TEXT DEFAULT 'windows', UNIQUE(date, domain)
  );
  CREATE TABLE browser_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    browser_name TEXT NOT NULL, profile_id TEXT NOT NULL, profile_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    browser_version TEXT, last_seen_at TEXT,
    total_duration_ms INTEGER DEFAULT 0, is_connected INTEGER DEFAULT 0,
    color_tag TEXT DEFAULT '#ec4899', known_app_name TEXT DEFAULT NULL,
    UNIQUE(browser_name, profile_id)
  );
`);

const q = (sql, ...p) => db.prepare(sql).all(...p);

// ── Helpers: payloads exactly as the extension builds them ──────────────────
const periodic = (domain, deltaMs, startAt, opts = {}) => ({
  url: `https://${domain}/x`, domain, title: 'T',
  tab_id: 1, timestamp: new Date(startAt).toISOString(),
  active_duration_ms: deltaMs, delta_ms: deltaMs, is_periodic: true,
  is_browser_focused: opts.focused ?? true,
  profileId: opts.profileId ?? 'p-firefox-main', browserName: opts.browser ?? 'Firefox',
  sanitized_url: `https://${domain}/x`,
});
// Tab switch / SW-suspend flush: timestamp = SESSION START (constant),
// delta_ms = 0, active_duration_ms = CUMULATIVE total.
const snapshot = (domain, sessionStartMs, totalMs, opts = {}) => ({
  url: `https://${domain}/`, domain, title: 'T',
  tab_id: 1, timestamp: new Date(sessionStartMs).toISOString(),
  active_duration_ms: totalMs, delta_ms: 0, is_periodic: false,
  is_browser_focused: opts.focused ?? true,
  profileId: opts.profileId ?? 'p-firefox-main', browserName: opts.browser ?? 'Firefox',
  sanitized_url: `https://${domain}/`,
});

const T0 = Date.parse('2026-11-12T10:00:00.000Z');
const rowsFor = (domain) => q(
  `SELECT id, timestamp, duration_ms, browser_name, profile_id FROM logs
    WHERE domain = ? ORDER BY id`, domain);
const dayBrowserSeconds = () =>
  q(`SELECT COALESCE(SUM(duration_ms),0) AS ms FROM logs WHERE is_browser_tracking=1`)[0].ms;
const browserSessionsTotal = () =>
  q(`SELECT COALESCE(SUM(total_sec),0) AS s FROM browser_sessions`)[0].s;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message}`); }
}

// ═══ A. THE 600-HOUR INCIDENT, REPLAYED ═════════════════════════════════════
// Session: YouTube from 10:00. Periodic ticks for 3 min, then the tab-switch
// snapshot (cumulative 3 h > 1 h ceiling) delivered 252× — MV3 SW restarts,
// focus changes, retry queue. Old daemon: 252 rows × 1 h = 252 h.
console.log('A. snapshot re-delivery (the 600-hour incident)');
{
  // 6 periodic ticks, 30 s apart
  for (let i = 0; i < 6; i++) ingest(periodic('youtube.com', 30000, T0 + i * 30000));
  const snapAt = T0 + 180000;               // session start + 3 min
  for (let i = 0; i < 252; i++) {
    const r = ingest(snapshot('youtube.com', snapAt, 3 * 3600000));
    assert.equal(r.ok, true, `snapshot #${i} rejected: ${r.reason}`);
  }
  check('one row per session, not 252', () => assert.equal(rowsFor('youtube.com').length, 1));
  check('duration = ticks(3min) raised to ceiling(1h), NOT 252 h', () =>
    assert.equal(rowsFor('youtube.com')[0].duration_ms, 3600000));
  check('day total ≤ 1 h (was 252 h)', () =>
    assert.ok(dayBrowserSeconds() <= 3600000, `got ${dayBrowserSeconds() / 3600000}h`));
  check('browser_sessions aggregate agrees', () =>
    assert.ok(Math.abs(browserSessionsTotal() - dayBrowserSeconds() / 1000) < 2));
  check('attribution columns written', () => {
    const r = rowsFor('youtube.com')[0];
    assert.equal(r.browser_name, 'Firefox');
    assert.equal(r.profile_id, 'p-firefox-main');
  });
}

// ═══ B. Periodic ticks accumulate into ONE row ══════════════════════════════
console.log('B. periodic ticks');
{
  const before = rowsFor('github.com').length;
  for (let i = 0; i < 6; i++) ingest(periodic('github.com', 30000, T0 + 10 * 60000 + i * 30000));
  const rows = rowsFor('github.com');
  check('6 ticks → 1 row', () => assert.equal(rows.length, before + 1));
  check('180 s accumulated', () => assert.equal(rows[rows.length - 1].duration_ms, 180000));
  // row timestamp stays at the FIRST tick (session start for hourly attribution)
  check('row timestamp = first tick', () =>
    assert.equal(rows[rows.length - 1].timestamp, new Date(T0 + 10 * 60000).toISOString()));
}

// ═══ C. Exact replay of a periodic payload is skipped ═══════════════════════
console.log('C. periodic replay dedupe');
{
  const p = periodic('docs.com', 30000, T0 + 20 * 60000);
  ingest(p);
  const after1 = rowsFor('docs.com')[0].duration_ms;
  const again = ingest({ ...p });           // identical payload re-delivered
  const after2 = rowsFor('docs.com')[0].duration_ms;
  check('replay ok:true', () => assert.equal(again.ok, true));
  check('replay adds nothing', () => assert.equal(after1, after2));
  check('replay flagged', () => assert.equal(again.replay, true));
}

// ═══ D. Snapshot RAISES (never adds, never lowers) ══════════════════════════
console.log('D. snapshot raise');
{
  // periodic brought the row to 5 min; snapshot claims cumulative 45 min
  for (let i = 0; i < 10; i++) ingest(periodic('reading.io', 30000, T0 + 30 * 60000 + i * 30000));
  const start = T0 + 30 * 60000;
  ingest(snapshot('reading.io', start, 45 * 60000));
  const r = rowsFor('reading.io');
  check('raised to 45 min (not 50+45)', () => assert.equal(r[0].duration_ms, 45 * 60000));
  // a LOWER total must not shrink the row
  ingest(snapshot('reading.io', start, 10 * 60000));
  check('lower snapshot never shrinks', () => assert.equal(r[0].duration_ms, 45 * 60000));
}

// ═══ E. Gap > merge window starts a NEW session row ═════════════════════════
console.log('E. session boundary');
{
  ingest(periodic('news.ycombinator.com', 30000, T0 + 40 * 60000));
  ingest(periodic('news.ycombinator.com', 30000, T0 + 41 * 60000));  // 1 min later
  ingest(periodic('news.ycombinator.com', 30000, T0 + 55 * 60000));  // 15 min later
  const rows = rowsFor('news.ycombinator.com');
  check('2 rows (in-window merge, out-of-window new)', () => assert.equal(rows.length, 2));
  check('durations 60s + 30s', () =>
    assert.deepEqual(rows.map(r => r.duration_ms), [60000, 30000]));
}

// ═══ F. Paused profile contributes NOTHING ══════════════════════════════════
console.log('F. paused profile');
{
  db.prepare(`INSERT INTO browser_profiles (browser_name, profile_id, is_active)
              VALUES ('Firefox', 'p-paused', 0)`).run();
  const r = ingest(periodic('somewhere.net', 60000, T0, { profileId: 'p-paused' }));
  check('skipped', () => assert.equal(r.ok, false));
  check('no row', () => assert.equal(rowsFor('somewhere.net').length, 0));
}

// ═══ G. Focus gate ═══════════════════════════════════════════════════════════
console.log('G. focus gate');
{
  // is_browser_focused=false AND the daemon's foreground read is not this
  // browser (module state: current() has no app) → skip.
  const r = ingest(periodic('phantom.example', 60000, T0, { focused: false }));
  check('unfocused payload skipped', () => assert.equal(r.ok, false));
  check('no phantom row', () => assert.equal(rowsFor('phantom.example').length, 0));
}

// ═══ G2. Fork-alias rescue: Zen foreground, extension self-reports Firefox ══
console.log('G2. fork-alias rescue (Zen UA misdetect)');
{
  const { setCurrentForTest } = await import('/tmp/opencode/probe-daemon-ingest.mjs');
  // Zen in the foreground (kdotool reports "zen"), extension's UA says Firefox,
  // extension's own alias check failed → is_browser_focused=false.
  setCurrentForTest('zen');
  const r = ingest(periodic('zen-rescued.example', 60000, T0 + 70 * 60000, { focused: false }));
  check('flag=false but OS says same-family browser → accepted', () => assert.equal(r.ok, true));
  check('row written', () => assert.equal(rowsFor('zen-rescued.example').length, 1));
  // A NON-browser foreground must still reject an unfocused payload.
  setCurrentForTest('org.kde.konsole');
  const r2 = ingest(periodic('phantom2.example', 60000, T0 + 70 * 60000, { focused: false }));
  check('unfocused payload vs IDE foreground → skipped', () => assert.equal(r2.ok, false));
  check('no phantom2 row', () => assert.equal(rowsFor('phantom2.example').length, 0));
  // A REAL different-family browser foreground must also reject.
  setCurrentForTest('google-chrome');
  const r3 = ingest(periodic('phantom3.example', 60000, T0 + 70 * 60000, { focused: false, browser: 'Firefox' }));
  check('unfocused firefox payload vs chrome foreground → skipped', () => assert.equal(r3.ok, false));
  setCurrentForTest(null);
}

// ═══ H. Two profiles, same browser, same domain → separate rows ═════════════
console.log('H. per-profile separation');
{
  ingest(periodic('mail.app', 30000, T0 + 60 * 60000, { profileId: 'p-work' }));
  ingest(periodic('mail.app', 30000, T0 + 60 * 60000 + 1000, { profileId: 'p-personal' }));
  const rows = rowsFor('mail.app');
  check('two rows', () => assert.equal(rows.length, 2));
  check('each 30 s (no cross-profile merge)', () =>
    assert.deepEqual(rows.map(r => r.duration_ms), [30000, 30000]));
}

// ═══ I. Grand total sanity for the whole simulated day ══════════════════════
console.log('I. day total');
check('every session row ≤ its 1 h ceiling', () => {
  const rows = q('SELECT domain, duration_ms FROM logs WHERE is_browser_tracking=1');
  const over = rows.filter(r => r.duration_ms > 3600000);
  assert.equal(over.length, 0, `rows over 1h: ${JSON.stringify(over)}`);
  // and no session produced twin rows at the same (domain, timestamp)
  const dupes = q(`SELECT domain, timestamp, COUNT(*) n FROM logs
                    WHERE is_browser_tracking=1 GROUP BY domain, timestamp HAVING n > 1`);
  assert.equal(dupes.length, 0, `duplicate session rows: ${JSON.stringify(dupes)}`);
  const ms = dayBrowserSeconds();
  console.log(`    day total: ${(ms / 60000).toFixed(1)} min across ${rows.length} session rows`);
});

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
db.close();
process.exit(fail ? 1 : 0);
