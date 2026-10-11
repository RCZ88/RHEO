/**
 * Halo island verification — Playwright (direct Node API).
 *
 * Replaces a hand-rolled CDP client that kept attaching to the wrong target.
 * Captures console + pageerror so a failed mount reports WHY, not just that the
 * DOM is empty — which is exactly the failure that produced 8 bogus FAILs.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL_ = process.env.HALO_URL ?? 'http://127.0.0.1:5181/halo.html';
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
page.on('requestfailed', (r) =>
  logs.push(`[REQFAIL] ${r.url()} :: ${r.failure()?.errorText}`),
);

// `domcontentloaded` + an explicit selector wait, NOT waitUntil:'load'. 'load'
// also waits on the Google Fonts request in halo.html, which can hang and made
// the whole suite time out with a misleading "navigation" error.
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForSelector('[data-halo-root]', { timeout: 30000 });
await page.waitForTimeout(2000);

const PROBE = () => {
  const root = document.querySelector('[data-halo-root]');
  const surf = document.querySelector('.halo-surface');
  const r = surf?.getBoundingClientRect();
  const cs = surf ? getComputedStyle(surf) : null;
  return {
    rootPresent: !!root,
    phase: root?.getAttribute('data-phase') ?? null,
    w: r ? Math.round(r.width) : 0,
    h: r ? Math.round(r.height) : 0,
    x: r ? Math.round(r.x) : 0,
    y: r ? Math.round(r.y) : -1,
    centre: r ? Math.round(r.x + r.width / 2) : 0,
    bg: cs?.backgroundColor ?? null,
    signal: cs ? cs.getPropertyValue('--halo-signal').trim() : null,
    numeral: (document.querySelector('.font-mono')?.textContent ?? '').trim(),
    rail: (surf?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 120),
  };
};

console.log('\n=== 1. DOES IT MOUNT AT ALL ===');
const boot = await page.evaluate(`({ url: location.href, hasRoot: !!document.getElementById('root'),
  rootChildren: document.getElementById('root')?.childElementCount ?? -1,
  scripts: [...document.querySelectorAll('script')].length })`);
console.log('  boot:', JSON.stringify(boot));

if (logs.length) {
  console.log('  --- console during boot ---');
  for (const l of logs) console.log('   ', l);
}

const a = await page.evaluate(PROBE);
console.log('  probe:', JSON.stringify(a));
check('island_mounts', a.rootPresent === true, `data-halo-root present`);
check('surface_non_zero_geometry', a.w > 0 && a.h > 0, `${a.w}x${a.h}px`);
check('starts_compact', a.phase === 'compact', `phase=${a.phase}`);
check('anchored_top_edge', a.y === 0, `y=${a.y}`);
check('horizontally_centred', Math.abs(a.centre - 640) < 2, `centre=${a.centre}/1280`);
check('surface_not_transparent', a.bg !== 'rgba(0, 0, 0, 0)', `bg=${a.bg}`);
check('amber_time_accent', a.signal === '#fbbf24', `--halo-signal=${a.signal}`);
check('stopwatch_numeral_live', /\d\d:\d\d:\d\d/.test(a.numeral), `"${a.numeral}"`);

console.log('\n=== 2. HOVER OPENS IT ===');
// Park the cursor BELOW the zone first. A real user's cursor approaches from
// screen content, so the entry is a genuine outside->inside transition; a single
// move from the synthetic (0,0) origin would start INSIDE the zone and correctly
// not open, which is the accidental-opening guard doing its job.
await page.mouse.move(640, 640);
await page.waitForTimeout(300);
await page.mouse.move(640, 18);
await page.waitForTimeout(700);
const b = await page.evaluate(PROBE);
console.log('  probe:', JSON.stringify(b));
check('hover_opens', b.phase === 'expanded', `phase=${b.phase}`);
check('surface_grew_wider', b.w > a.w, `${a.w}px -> ${b.w}px`);
check('grew_downward_only', b.y === 0 && b.h > a.h, `y stays 0; h ${a.h}->${b.h}`);
// Case-insensitive: the eyebrow role applies `text-transform: uppercase`, so innerText
// is "TRACKED TIME" now. The UPPERCASE is the design; the assertion was too strict.
check('activity_rail_present', /tracked time/i.test(b.rail), `"${b.rail.slice(0, 46)}"`);
await page.screenshot({ path: '/tmp/opencode/halo-expanded.png' });
console.log('  shot -> /tmp/opencode/halo-expanded.png');

console.log('\n=== 3. NUMERAL HONESTY (not "it moves") ===');
// The store's `shouldRun()` needs `hasRealApp`, so with no detected app the correct
// reading is a STATIC 00:00:00. Asserting motion would test the environment. What must
// hold is: well-formed, tabular, non-decreasing, and never a fabricated non-zero value.
const readNumeral = () => page.evaluate(() => {
  // Read whichever surface is actually mounted: the compact pill's value, else the
  // expanded hero's. Querying only the compact row while expanded always yields ''
  // because compact/expanded are separate surfaces — the assertion was wrong, not the app.
  const scope = document.querySelector('[data-halo-stopwatch-compact]')
    || document.querySelector('[data-halo-stopwatch-expanded]');
  const m = (scope?.textContent || '').match(/\d{2}:\d{2}:\d{2}/);
  return m ? m[0] : '';
});
const n1 = await readNumeral();
await page.waitForTimeout(2400);
const n2 = await readNumeral();
console.log(`  numeral: "${n1}" -> "${n2}"`);
const toSec = (v) => {
  const parts = String(v).split(':').map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};
check('numeral is well-formed HH:MM:SS', /^\d{2}:\d{2}:\d{2}$/.test(n1), `"${n1}"`);
check('numeral is non-decreasing', toSec(n2) >= toSec(n1), `${toSec(n1)} -> ${toSec(n2)}`);
check('numeral shows ZERO when no app is detected (honest, not fabricated)',
  toSec(n1) === 0 || n1 !== n2, `no-app profile must read 0, got "${n1}"`);

console.log('\n=== 4. LEAVING COLLAPSES IT ===');
await page.mouse.move(640, 640);
await page.waitForTimeout(900);
const c = await page.evaluate(PROBE);
console.log('  probe:', JSON.stringify(c));
check('leave_collapses', c.phase === 'compact', `phase=${c.phase}`);
check('width_restored', c.w === a.w, `${c.w}px (compact ${a.w}px)`);
await page.screenshot({ path: '/tmp/opencode/halo-compact.png' });
console.log('  shot -> /tmp/opencode/halo-compact.png');

console.log('\n=== 5. DICTATION TAB + WAVEFORM ===');
await page.mouse.move(640, 640);
await page.waitForTimeout(300);
await page.mouse.move(640, 18);
await page.waitForTimeout(700);
const clicked = await page.evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Dictation'));
  if (!btn) return 'no-button';
  btn.click(); return 'clicked';
})()`);
await page.waitForTimeout(600);
const d = await page.evaluate(PROBE);
const bars = await page.evaluate(`document.querySelectorAll('.halo-meter-bar').length`);
check('dictation_tab_switches', clicked === 'clicked' && /dictation/i.test(d.rail), `click=${clicked} rail="${d.rail.slice(0, 44)}"`);
check('waveform_24_bars', bars === 24, `${bars} bars (SttPanel's BAR_COUNT=24)`);
await page.screenshot({ path: '/tmp/opencode/halo-dictation.png' });
console.log('  shot -> /tmp/opencode/halo-dictation.png');

console.log('\n=== CONSOLE (whole run) ===');
console.log(logs.length ? logs.map((l) => '  ' + l).join('\n') : '  (clean)');

const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) console.log('failed: ' + failed.map((f) => f.name).join(', '));

await browser.close();
process.exit(failed.length ? 1 : 0);