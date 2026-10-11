/**
 * Does the MAIN app still contain a React #321 (invalid hook call) site?
 *
 * Uses the DEV server, not the production bundle, on purpose: dev React is
 * unminified, so a surviving violation reports the real message AND the
 * component stack instead of "Minified React error #321". The production bundle
 * cannot be tested here because an agent must not run a build (§0-0).
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs = [], warns = [];
p.on('pageerror', e => errs.push(e.message + '\n' + (e.stack||'').split('\n').slice(0,10).join('\n')));
p.on('console', m => { if (m.type()==='error') errs.push('[console] '+m.text()); if (m.type()==='warning') warns.push(m.text()); });

// Stub the preload bridge BEFORE any app code runs. Without it the renderer throws
// on the first IPC call, the tree never mounts, and a "0 errors" result is
// MEANINGLESS — which is exactly what the first run of this probe reported.
await p.addInitScript(() => {
  const noop = () => {};
  const asyncEmpty = async () => ({});
  const api = new Proxy({}, {
    get(_t, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'then') return undefined;            // not a thenable
      if (prop.startsWith('on')) return () => noop;     // event subscribe -> unsubscribe
      return asyncEmpty;                                // invoke -> {}
    },
  });
  Object.defineProperty(window, 'deskflowAPI', { get: () => api, configurable: true });
  Object.defineProperty(window, 'haloBridge',   { get: () => undefined, configurable: true });
  window.electron = { ipcRenderer: { invoke: async () => ({}), on: noop, send: noop } };
});

await p.goto('http://127.0.0.1:5190/index.html', { waitUntil:'domcontentloaded', timeout:60000 });
await p.waitForTimeout(20000);

const hookish = errs.filter(e => /Invalid hook call|#321|Rendered (more|fewer) hooks|Cannot read.*use[A-Z]|dispatcher/i.test(e));
const all321  = errs.filter(e => /#321|Invalid hook call/i.test(e));

console.log(`total errors captured : ${errs.length}`);
console.log(`HOOK violations (#321): ${all321.length}`);
console.log(`any hook-ish error    : ${hookish.length}`);
console.log(`React DevTools banner : ${warns.some(w=>/DevTools/i.test(w)) ? 'present (React loaded)' : 'absent'}`);
console.log(`#root child count     : ${await p.evaluate(`document.getElementById('root')?.childElementCount ?? -1`)}`);

if (all321.length) { console.log('\n--- #321 DETAIL ---'); all321.forEach(e=>console.log(e)); }
const other = errs.filter(e=>!/#321|Invalid hook call/i.test(e)).slice(0,6);
if (other.length) { console.log('\n--- other errors (first 6) ---'); other.forEach(e=>console.log('  '+e.split('\n')[0].slice(0,150))); }

const pass = all321.length === 0;
console.log(`\n=== ${pass ? 'PASS' : 'FAIL'}: no React #321 in the dev build ===`);
await b.close();
process.exit(pass?0:1);
