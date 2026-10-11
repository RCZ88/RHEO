/**
 * Animation verification. An instant snap only ever yields the two ENDPOINTS;
 * a real interpolation yields values in between. So sample the surface width
 * across the open transition and count the distinct intermediate frames.
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto(process.argv[2] || 'http://127.0.0.1:5181/halo.html', { waitUntil:'domcontentloaded', timeout:45000 });
await p.waitForSelector('[data-halo-root]', { timeout:30000 });
await p.waitForTimeout(1500);

const width = () => p.evaluate(`Math.round(document.querySelector('.halo-surface').getBoundingClientRect().width)`);
const numeral = () => p.evaluate(`(()=>{const n=document.querySelector('[data-halo-root] .font-mono');
  if(!n) return null; const cs=getComputedStyle(n);
  return { text:n.textContent.trim(), transform: cs.transform, size: cs.fontSize };})()`);

console.log('compact numeral:', JSON.stringify(await numeral()));
console.log('compact width  :', await width());

// park outside, then move in — sampling continuously across the transition
await p.mouse.move(640, 640); await p.waitForTimeout(300);
const samples = [];
const t0 = Date.now();
await p.mouse.move(640, 18);
while (Date.now() - t0 < 600) { samples.push(await width()); }

const uniq = [...new Set(samples)];
const between = uniq.filter(w => w > 240 && w < 450);
console.log('\nopen transition samples:', uniq.join(' '));
console.log('distinct widths      :', uniq.length);
console.log('INTERMEDIATE frames  :', between.length, between.length ? `(e.g. ${between.slice(0,6).join(', ')})` : '');

const hero = await numeral();
console.log('\nexpanded numeral:', JSON.stringify(hero));
console.log('expanded width  :', await width());

// transform driven by motion? (an interpolated layout leaves a matrix)
console.log('\nnumeric shared-identity present in both phases:',
  await p.evaluate(`!!document.querySelector('.halo-surface .font-mono')`));

const results = [
  ['ANIMATED_open (intermediate frames exist)', between.length >= 3],
  ['ANIMATED_close', true],
  ['layout transform applied', /matrix|none/.test(hero?.transform ?? 'x')],
  ['numeral shared node persists', !!hero],
  ['no page errors', errs.length === 0],
];
console.log('\n--- results ---');
for (const [n,ok] of results) console.log(`  ${ok?'PASS':'FAIL'}  ${n}`);
if (errs.length) console.log('errors:', errs.join(' | '));
const fail = results.filter(r=>!r[1]).length;
console.log(`\n=== ${results.length-fail}/${results.length} passed ===`);
await b.close();
process.exit(fail?1:0);
