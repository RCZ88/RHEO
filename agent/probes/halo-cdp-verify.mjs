/**
 * Halo island verification — browser-level CDP.
 *
 * Two traps this avoids, both hit while getting here:
 *  1. Only ONE debugger client may attach to a PAGE target. The Playwright MCP
 *     had already attached (its log reached `ws connected`), so a second
 *     page-level websocket opens and then silently never replies — which is why
 *     `Runtime.enable` itself timed out. Attaching via the BROWSER endpoint with
 *     Target.createTarget + attachToTarget(flatten) sidesteps it entirely.
 *  2. `chrome --dump-dom --virtual-time-budget` HANGS against a page with a
 *     never-ending setInterval (the fixture stopwatch ticks every 1s), so the
 *     budget never completes. Real CDP has no such budget.
 */
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';

const CDP_HTTP = 'http://127.0.0.1:9223';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const v = await (await fetch(`${CDP_HTTP}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 << 20 });
await new Promise((r) => ws.once('open', r));

let id = 0;
const pend = new Map();
const consoleLines = [];
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleLines.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text));
  }
});

function raw(method, params = {}, sessionId) {
  const i = ++id;
  const payload = { id: i, method, params };
  if (sessionId) payload.sessionId = sessionId;
  return new Promise((resolve, reject) => {
    pend.set(i, { resolve, reject });
    ws.send(JSON.stringify(payload));
    setTimeout(() => {
      if (pend.has(i)) {
        pend.delete(i);
        reject(new Error(`timeout ${method}`));
      }
    }, 25000);
  });
}

// Navigate by CREATING the target at the URL. Page.navigate never returned a
// reply on this box even though the browser-level commands did, so the URL goes
// into Target.createTarget instead and readiness is polled with Runtime.evaluate.
// Attach to the page Chrome was LAUNCHED with. Target.createTarget silently
// ignored its `url` argument on this build and produced about:blank, so the URL
// is supplied on the command line instead.
const list = await (await fetch(`${CDP_HTTP}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('halo.html'));
if (!page) {
  console.error('no halo.html page target. saw:', list.map((t) => t.url));
  process.exit(2);
}
const targetId = page.id;
console.log('attaching to', page.url);
const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
console.log('attached session', sessionId);

const send = (m, p) => raw(m, p, sessionId);
await send('Runtime.enable');

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description ?? ''));
  }
  return r.result.value;
}

for (let i = 0; i < 50; i += 1) {
  await sleep(400);
  try {
    if ((await evaluate('document.readyState')) === 'complete') break;
  } catch {}
}
await sleep(1500);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

const PROBE = `(() => {
  const root = document.querySelector('[data-halo-root]');
  const surf = document.querySelector('.halo-surface');
  const r = surf ? surf.getBoundingClientRect() : null;
  const cs = surf ? getComputedStyle(surf) : null;
  return {
    rootPresent: !!root,
    phase: root ? root.getAttribute('data-phase') : null,
    w: r ? Math.round(r.width) : 0,
    h: r ? Math.round(r.height) : 0,
    x: r ? Math.round(r.x) : 0,
    y: r ? Math.round(r.y) : -1,
    centre: r ? Math.round(r.x + r.width / 2) : 0,
    bg: cs ? cs.backgroundColor : null,
    signal: cs ? cs.getPropertyValue('--halo-signal').trim() : null,
    numeral: (document.querySelector('.font-mono')?.textContent || '').trim(),
    rail: (surf?.innerText || '').replace(/\\s+/g,' ').slice(0,120),
  };
})()`;

console.log('\n=== 1. RENDERS ON A COLD LOAD ===');
const a = await evaluate(PROBE);
console.log('  ', JSON.stringify(a));
check('island_mounts', a.rootPresent === true, `[data-halo-root] present`);
check('surface_non_zero_geometry', a.w > 0 && a.h > 0, `${a.w}x${a.h}px`);
check('starts_compact', a.phase === 'compact', `phase=${a.phase}`);
check('anchored_to_top', a.y === 0, `top edge y=${a.y}`);
check('horizontally_centred', Math.abs(a.centre - 640) < 2, `centre=${a.centre} of 1280`);
check('opaque_surface_not_transparent', a.bg !== 'rgba(0, 0, 0, 0)', `background=${a.bg}`);
check('amber_time_accent', a.signal === '#fbbf24', `--halo-signal=${a.signal}`);
check('stopwatch_numeral_live', /\d\d:\d\d:\d\d/.test(a.numeral), `numeral="${a.numeral}"`);

console.log('\n=== 2. HOVER OPENS IT ===');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 18, buttons: 0 });
await sleep(800);
const b = await evaluate(PROBE);
console.log('  ', JSON.stringify(b));
check('hover_opens', b.phase === 'expanded', `phase=${b.phase}`);
check('surface_grew', b.w > a.w, `${a.w}px -> ${b.w}px wide`);
check('grew_downward_only', b.y === 0 && b.h > a.h, `top still y=0, height ${a.h}->${b.h}`);
check('activity_rail_present', b.rail.includes('Tracked time'), `rail text="${b.rail.slice(0, 44)}"`);

const shotExp = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('/tmp/opencode/halo-expanded.png', Buffer.from(shotExp.data, 'base64'));

console.log('\n=== 3. THE NUMERAL TICKS ===');
const n1 = (await evaluate(PROBE)).numeral;
await sleep(2400);
const n2 = (await evaluate(PROBE)).numeral;
check('numeral_advances', n1 !== n2, `"${n1}" -> "${n2}"`);

console.log('\n=== 4. LEAVING COLLAPSES IT ===');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 640, buttons: 0 });
await sleep(900);
const c = await evaluate(PROBE);
console.log('  ', JSON.stringify(c));
check('leave_collapses', c.phase === 'compact', `phase=${c.phase}`);
check('width_restored', c.w === a.w, `${c.w}px (compact was ${a.w}px)`);

const shotCom = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('/tmp/opencode/halo-compact.png', Buffer.from(shotCom.data, 'base64'));

console.log('\n=== 5. DICTATION TAB ===');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 18, buttons: 0 });
await sleep(700);
const clicked = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Dictation'));
  if (!btn) return 'no-button';
  btn.click();
  return 'clicked';
})()`);
await sleep(500);
const d = await evaluate(PROBE);
check('dictation_tab_switches', clicked === 'clicked' && d.rail.includes('Dictation'), `click=${clicked} rail="${d.rail.slice(0,50)}"`);
const bars = await evaluate(`document.querySelectorAll('.halo-meter-bar').length`);
check('waveform_bars_render', bars === 24, `${bars} bars (matches SttPanel's BAR_COUNT)`);

console.log('\n=== CONSOLE ===');
console.log(consoleLines.length ? consoleLines.map((l) => '  ' + l).join('\n') : '  (clean)');

const failed = results.filter((r) => !r.ok);
console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
await raw('Target.closeTarget', { targetId });
ws.close();
process.exit(failed.length ? 1 : 0);