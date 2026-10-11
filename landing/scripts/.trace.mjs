import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3004/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
// FRAME TRACE FIRST: measure the curve before reading any source.
const r = await p.evaluate(async () => {
  const out = {};
  for (const id of ["act-record", "download"]) {
    const sec = document.getElementById(id);
    sec.scrollIntoView({ behavior: "instant", block: "start" });
    let worst = 0, who = null, whoEl = null;
    const trace = [];
    const t0 = performance.now();
    await new Promise(res => {
      const f = () => {
        sec.querySelectorAll("*").forEach(el => {
          const cs = getComputedStyle(el);
          if (!cs.transform || cs.transform === "none") return;
          const m = new DOMMatrixReadOnly(cs.transform);
          const ty = Math.abs(m.m42);
          if (ty > worst) { worst = ty; whoEl = el; }
        });
        if (whoEl) {
          const cs = getComputedStyle(whoEl);
          const m = new DOMMatrixReadOnly(cs.transform);
          trace.push({ t: Math.round(performance.now()-t0), ty: +Math.abs(m.m42).toFixed(1),
                       sy: Math.round(scrollY), anim: cs.animationName, trans: cs.transitionProperty.slice(0,28) });
        }
        if (performance.now() - t0 < 1600) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
    out[id] = {
      worst: +worst.toFixed(1),
      ident: whoEl ? `${whoEl.tagName}${whoEl.id?"#"+whoEl.id:""}.${String(whoEl.className||"(no class)")}`.slice(0,90) : "none",
      text: whoEl ? (whoEl.textContent||"").trim().slice(0,40) : "",
      parent: whoEl?.parentElement ? `${whoEl.parentElement.tagName}.${String(whoEl.parentElement.className||"(none)")}`.slice(0,60) : "",
      inline: whoEl?.getAttribute("style")?.slice(0,120) || "(no inline style)",
      trace: trace.filter((_,i)=>i%6===0).slice(0,12),
    };
  }
  return out;
});
for (const [id, o] of Object.entries(r)) {
  console.log(`\n  === ${id} ===  max|ty| = ${o.worst}`);
  console.log(`    element : ${o.ident}`);
  console.log(`    text    : "${o.text}"`);
  console.log(`    parent  : ${o.parent}`);
  console.log(`    inline  : ${o.inline}`);
  console.log(`    trace (t, ty, scrollY, animation, transition):`);
  o.trace.forEach(x => console.log(`      t=${String(x.t).padEnd(5)} ty=${String(x.ty).padEnd(6)} scrollY=${String(x.sy).padEnd(6)} anim=${x.anim} trans=${x.trans}`));
}
await b.close();
