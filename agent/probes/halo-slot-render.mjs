/** Runtime proof the SLOT MODEL is actually driving the DOM, not just compiling. */
import { chromium } from 'playwright';
const URL_ = process.env.HALO_URL ?? 'http://127.0.0.1:5181/halo.html';
const b = await chromium.launch({ args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('[console] '+m.text()); });
await p.goto(URL_, { waitUntil:'domcontentloaded', timeout:60000 });
await p.waitForSelector('[data-halo-root]', { timeout:30000 });

let pass=0, fail=0;
const ok=(n,c,d='')=>{ c?(pass++,console.log(`  ok   ${n}${d?'  '+d:''}`)):(fail++,console.log(`  FAIL ${n}  ${d}`)); };

// compact: honest empty, no fake numbers
let c = await p.evaluate(()=>{
  const root=document.querySelector('[data-halo-root]');
  const surf=document.querySelector('.halo-surface');
  return { strip:surf?.getAttribute('data-halo-strip') ?? null,
           width:surf?.getAttribute('data-halo-width') ?? null,
           empty:!!document.querySelector('[data-halo-empty]'),
           sr:document.querySelector('#halo-resident-state')?.textContent ?? null };
});
console.log('\n-- compact --'); console.log('  ', JSON.stringify(c));
ok('compact width class SM at 1 activity', c.width==='SM', `got ${c.width}`);
ok('no empty-strip block while collapsed', c.empty===false);
// Either literal is CORRECT depending on the producer: 'No app detected' when unknown,
// '0:00:00' when the store genuinely reports zero. The invariant that must always hold is
// that it is one of those two honest values and never a fabricated non-zero.
ok('resident honest state is an honest literal (never fabricated)',
   c.sr==='No app detected' || /^0:00:00$/.test(c.sr), `sr="${c.sr}"`);

// hover -> expanded; the empty strip MUST appear because nothing publishes a rail card
await p.mouse.move(640, 640);
await p.mouse.move(640, 18);
await p.waitForTimeout(1400);
c = await p.evaluate(()=>{
  const root=document.querySelector('[data-halo-root]');
  const surf=document.querySelector('.halo-surface');
  return { phase:root?.getAttribute('data-phase'), strip:surf?.getAttribute('data-halo-strip') ?? null,
           width:surf?.getAttribute('data-halo-width') ?? null,
           empty:document.querySelector('[data-halo-empty]')?.textContent ?? null };
});
console.log('\n-- expanded --'); console.log('  ', JSON.stringify(c));
ok('phase expanded', c.phase==='expanded', `got ${c.phase}`);
ok('strip mode == empty (no rail producers yet)', c.strip==='empty', `got ${c.strip}`);
ok('HONEST EMPTY copy rendered verbatim',
   c.empty==='Nothing to rotate — widgets appear as features publish', `got "${c.empty}"`);
ok('width class still SM (hero only)', c.width==='SM', `got ${c.width}`);

// no fabricated measurement anywhere in the DOM
const txt = await p.evaluate(()=>document.body.innerText);
ok('no fabricated 3h-style fixture', !/3[:h]\s?47/.test(txt));
ok('amber signal token is a var(), not raw hex in markup', !/#[0-9a-fA-F]{6}/.test(
   await p.evaluate(()=>document.querySelector('[data-halo-root]')?.outerHTML||'')));

ok('zero pageerror events', errs.length===0, errs.slice(0,2).join(' | '));
console.log(`\n=== ${fail===0?'PASS':'FAIL'}: ${pass} passed, ${fail} failed ===`);
await b.close(); process.exit(fail===0?0:1);
