import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3004/", { waitUntil: "networkidle" });
await p.addInitScript(() => { try { localStorage.setItem("rheo-motion","off"); } catch {} });
await p.reload({ waitUntil: "networkidle" });
await p.locator("#download").scrollIntoViewIfNeeded();
await p.waitForTimeout(500);
const r = await p.evaluate(async () => {
  const sec = document.getElementById("download");
  const seen = new Map(), movers = [];
  const t0 = performance.now();
  await new Promise(res => {
    const f = () => {
      sec.querySelectorAll("*").forEach(el => {
        const cs = getComputedStyle(el);
        if (!cs.transform || cs.transform === "none") return;
        const ty = Math.abs(new DOMMatrixReadOnly(cs.transform).m42);
        const rec = seen.get(el);
        if (!rec) seen.set(el, { first: ty, last: ty, peak: 0 });
        else {
          const d = Math.max(Math.abs(ty - rec.first), ty - rec.last, rec.peak);
          seen.set(el, { first: rec.first, last: ty, peak: d });
          if (d > 0.5 && !movers.find(m => m.el === el))
            movers.push({ el, d, first: rec.first, last: ty });
        }
      });
      if (performance.now() - t0 < 1800) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  return movers.map(m => ({
    d: +m.d.toFixed(1), from: +m.first.toFixed(1), to: +m.last.toFixed(1),
    ident: `${m.el.tagName}.${String(m.el.className||"(none)")}`.slice(0,70),
    inline: (m.el.getAttribute("style")||"").slice(0,100),
  })).sort((a,b)=>b.d-a.d).slice(0,5);
});
console.log("  movers under store-off:");
r.forEach(m => console.log(`    delta=${m.d}px (${m.from} -> ${m.to})  ${m.ident}\n      inline: ${m.inline}`));
await b.close();
