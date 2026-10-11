/** Screenshot the island in both phases AND measure its type system, so "it looks
 *  clean" becomes a number instead of an opinion. */
import { chromium } from 'playwright';
const URL_=process.env.HALO_URL??'http://127.0.0.1:5182/halo.html';
const b=await chromium.launch({args:['--no-sandbox','--disable-gpu']});
const p=await b.newPage({viewport:{width:1280,height:800}, deviceScaleFactor:2});
await p.addInitScript(()=>{
  window.__haloPrefs=null; const L=[];
  window.__pushHaloPrefs=(v)=>{window.__haloPrefs=v;L.forEach(cb=>cb(v));};
  window.haloBridge={onPrefs:(cb)=>{L.push(cb);return ()=>{};},onSnapshot:()=>()=>{},onCommand:()=>()=>{},getSnapshot:async()=>({}),setPinned:async()=>({})};
});
await p.goto(URL_,{waitUntil:'domcontentloaded'});
await p.waitForSelector('[data-halo-root]',{timeout:30000});
await p.evaluate(()=>window.__pushHaloPrefs({enabled:true,scale:1,edge:'top',shape:'capsule'}));
await p.waitForTimeout(400);
await p.screenshot({path:'/tmp/opencode/v-compact.png', clip:{x:400,y:0,width:480,height:120}});
await p.mouse.move(640,640); await p.waitForTimeout(300);
await p.mouse.move(640,18);   await p.waitForTimeout(1200);
await p.screenshot({path:'/tmp/opencode/v-expanded.png', clip:{x:320,y:0,width:640,height:320}});

// Measure the actual computed type system.
const m = await p.evaluate(()=>{
  const sizes=new Map(), families=new Map();
  document.querySelectorAll('.halo-surface *').forEach(el=>{
    const cs=getComputedStyle(el); const txt=(el.textContent||'').trim();
    if(!txt || el.children.length>0) return;
    const k=cs.fontSize; sizes.set(k,(sizes.get(k)??0)+1);
    families.set(cs.fontFamily.split(',')[0],(families.get(cs.fontFamily.split(',')[0])??0)+1);
  });
  const s=document.querySelector('.halo-surface'); const cs=s?getComputedStyle(s):null;
  return { sizes:[...sizes.entries()].sort((a,b)=>parseFloat(b[0])-parseFloat(a[0])),
           families:[...families.entries()],
           shell:{w:s?.getBoundingClientRect().width, h:s?.getBoundingClientRect().height,
                  bg:cs?.backgroundColor, radius:cs?.borderTopLeftRadius, border:cs?.borderTopWidth} };
});
console.log('TYPE SIZES USED:'); m.sizes.forEach(([s,n])=>console.log(`   ${s.padEnd(8)} x${n}`));
console.log('FONT FAMILIES:');  m.families.forEach(([f,n])=>console.log(`   ${f.padEnd(18)} x${n}`));
console.log('SHELL:', JSON.stringify(m.shell));
console.log('distinct sizes =', m.sizes.length);
await b.close();
