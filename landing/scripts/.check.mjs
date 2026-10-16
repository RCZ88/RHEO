import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(2000);

console.log("=== Checking #act-record ===");
const actRecord = await p.evaluate(() => {
  const sec = document.getElementById("act-record");
  if (!sec) return { error: "Section not found" };
  const vid = sec.querySelector("video");
  const phases = sec?.querySelectorAll('[data-phase]');
  const videoPlaying = vid ? { 
    src: vid.src, 
    paused: vid.paused, 
    currentTime: vid.currentTime, 
    duration: vid.duration,
    poster: vid.poster,
    style: vid.style.cssText 
  } : null;
  const scrollY = window.scrollY;
  return { videoPlaying, phases: document.querySelectorAll('[data-phase]').length, scrollY };
});
console.log("ActRecord:", JSON.stringify(actRecord, null, 2));

console.log("\n=== Checking #understand (ASCII section) ===");
const understand = await p.evaluate(() => {
  const sec = document.getElementById("understand");
  if (!sec) return { error: "Section not found" };
  const ascii = sec.querySelector("canvas");
  const asciiText = sec.querySelector("pre, code, .ascii")?.textContent?.slice(0, 100);
  return { hasCanvas: !!ascii, asciiText: asciiText?.slice(0, 200) };
});
console.log("Understand:", JSON.stringify(understand, null, 2));

console.log("\n=== Checking gallery carousel ===");
const gallery = await p.evaluate(() => {
  const rail = document.querySelector(".gallery-rail");
  const slides = document.querySelectorAll(".gallery-slide");
  return { slides: slides.length, railWidth: rail?.offsetWidth, firstSlide: document.querySelector(".gallery-slide")?.outerHTML?.slice(0, 200) };
});
console.log("Gallery:", JSON.stringify(gallery, null, 2));

await b.close();
