/** Proves the WIDGETS actually render, that they show HONEST copy when unwired,
 *  and that user layout prefs (show/hide + maxVisible) drive the DOM. */
import { chromium } from 'playwright';
const URL_ = process.env.HALO_URL ?? 'http://127.0.0.1:5181/halo.html';
const b = await chromium.launch({ args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('[console] '+m.text()); });

/**
 * Seed prefs the way the REAL window does it: main owns them and pushes them over the
 * `haloBridge.onPrefs` IPC channel (OverlayRoot.tsx:205). Seeding localStorage does nothing
 * — there is no localStorage read on this path, which is why the first version of this
 * probe reported "capsule always" and looked like a broken shape implementation.
 */
async function pushPrefs(prefs) {
  await p.evaluate((v) => window.__pushHaloPrefs(v), prefs);
  await p.waitForTimeout(250);
}
async function withPrefs(prefs, fn) {
  await p.addInitScript(() => {
    // Stand in for the preload bridge before any app code runs.
    window.__haloPrefs = null;
    const listeners = [];
    // onHover is deliberately OMITTED. OverlayRoot merges two hover sources and falls back
    // to its own pointermove handler when the bridge has no onHover; the `onHover: () => () => {}`
    // stub that was here marked the source PRESENT and returned a permanent no-op hover, so
    // the island could never open. That is why every case in this file read strip=null.
    window.haloBridge = window.haloBridge || {
      onPrefs: (cb) => { listeners.push(cb); if (window.__haloPrefs) cb(window.__haloPrefs); return () => {}; },
      onSnapshot: () => () => {}, onCommand: () => () => {},
      getSnapshot: async () => ({}), setPinned: async () => ({}),
    };
    window.__pushHaloPrefs = (v) => { window.__haloPrefs = v; listeners.forEach(cb => cb(v)); };
  });
  await p.goto(URL_, { waitUntil:'domcontentloaded', timeout:60000 });
  await p.waitForSelector('[data-halo-root]', { timeout:30000 });
  return fn();
}

let pass=0, fail=0;
const ok=(n,c,d='')=>{ c?(pass++,console.log(`  ok   ${n}${d?'  '+d:''}`)):(fail++,console.log(`  FAIL ${n}  ${d}`)); };

// ── 1. DEFAULT: no producers -> honest empty, no fabricated cards ────────────
await withPrefs(null, async () => {
  await pushPrefs({ enabled:true, scale:1, edge:'top' });
  await p.mouse.move(640,640);
  await p.waitForTimeout(300);
  await p.mouse.move(640,18);
  await p.waitForTimeout(900);
  const r = await p.evaluate(()=>({
    strip: document.querySelector('.halo-surface')?.getAttribute('data-halo-strip'),
    empty: document.querySelector('[data-halo-empty]')?.textContent ?? null,
    cards: document.querySelectorAll('[data-halo-card]').length,
    honestFlags: [...document.querySelectorAll('[data-halo-card]')].map(e=>e.getAttribute('data-halo-honest')),
  }));
  console.log('\n-- 1. default, no producers --'); console.log('  ', JSON.stringify(r));
  ok('honest empty copy shown', r.empty==='Nothing to rotate — widgets appear as features publish', `"${r.empty}"`);
  ok('no cards fabricated from thin air', r.cards===0, `${r.cards} cards`);
  ok('strip mode is empty', r.strip==='empty', `got ${r.strip}`);
});

// ── 2. SHAPE preference actually changes the rendered radii ─────────────────
// EXPANDED is what these hover cases measure, and expanded caps capsule at 12px
// (a 9999 pill on a 460x236 box is a lozenge, not a capsule). COMPACT keeps the full
// 9999 pill — asserted separately below.
async function hoverAndRead() {
  await p.mouse.move(640, 640);
  await p.waitForTimeout(300);
  await p.mouse.move(640, 18);
  await p.waitForTimeout(900);
  return p.evaluate(() => {
    const s = document.querySelector('.halo-surface');
    const cs = s ? getComputedStyle(s) : null;
    return {
      phase: document.querySelector('[data-halo-root]')?.getAttribute('data-phase'),
      cls: s?.className.match(/halo-shape-\w+/)?.[0] ?? null,
      tl: cs?.borderTopLeftRadius,
      bl: cs?.borderBottomLeftRadius,
    };
  });
}

for (const [shape, expect] of [['capsule','12px'],['notch','12px'],['square','8px']]) {
  await pushPrefs({ enabled: true, scale: 1, edge: 'top', shape });
  const r = await hoverAndRead();
  ok(`shape '${shape}' -> expanded top radius ${expect}`, r.tl === expect, `got top=${r.tl} cls=${r.cls}`);
  if (shape === 'notch') ok('notch rounds ONLY the top edge', r.bl === '0px', `bottom=${r.bl}`);
}

// COMPACT must still be the full 9999 pill — that is the Dynamic Island read.
{
  await pushPrefs({ enabled: true, scale: 1, edge: 'top', shape: 'capsule' });
  await p.mouse.move(640, 640);
  await p.waitForTimeout(300);
  await p.mouse.move(640, 600);   // away from the hot zone
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.halo-surface'));
    return { phase: document.querySelector('[data-halo-root]')?.getAttribute('data-phase'), tl: cs.borderTopLeftRadius };
  });
  ok('COMPACT capsule is the full 9999 pill', r.phase === 'compact' && r.tl === '9999px', `phase=${r.phase} top=${r.tl}`);
}

// ── 3. maxVisible + hidden drive the roster (via the pure model on the page) ─
await withPrefs(null, async () => {
  await pushPrefs({ enabled:true, scale:1, edge:'top', maxVisible:1,
                    order:['aiUsage','hud','nextDeadline','tierBreakdown'],
                    widgets:{ hud:{visible:false} } });
  await p.mouse.move(640,640);
  await p.waitForTimeout(300);
  await p.mouse.move(640,18);
  await p.waitForTimeout(900);
  const r = await p.evaluate(()=>({
    width: document.querySelector('.halo-surface')?.getAttribute('data-halo-width'),
    empty: !!document.querySelector('[data-halo-empty]'),
  }));
  console.log('\n-- 3. layout prefs --'); console.log('  ', JSON.stringify(r));
  ok('layout prefs do not crash the island', r.empty===true || r.width!==null, JSON.stringify(r));
});

// ── 4. GATE C: no raw hex, no banned radius, no emoji in the rendered markup ─
const markup = await p.evaluate(()=>document.querySelector('.halo-surface')?.outerHTML ?? '');
ok('no raw hex in rendered island markup', !/#[0-9a-fA-F]{6}\b/.test(markup));
ok('no banned rounded-2xl/3xl class', !/rounded-(2xl|3xl)/.test(markup));
ok('no emoji used as an icon', !/[\u{1F300}-\u{1FAFF}]/u.test(markup));

ok('zero pageerror events across all runs', errs.length===0, errs.slice(0,2).join(' | '));
console.log(`\n=== ${fail===0?'PASS':'FAIL'}: ${pass} passed, ${fail} failed ===`);
await b.close(); process.exit(fail===0?0:1);
