import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1208', 'chrome-win64', 'chrome.exe') : undefined,
  process.env.HOME ? join(process.env.HOME, '.cache/ms-playwright/chromium-1208/chrome-linux/chrome') : undefined,
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) throw new Error('No Chrome found: run `npx playwright install chromium` or set CHROME_PATH');
const URL = 'http://127.0.0.1:5173/';

const errors = [];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500); // let fonts + canvas settle

const h1 = page.locator('h1').first();
const h1Font = await h1.evaluate(el => getComputedStyle(el).fontFamily);
const h1Weight = await h1.evaluate(el => getComputedStyle(el).fontWeight);
const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

// Fonts actually loaded?
const fontsLoaded = await page.evaluate(async () => {
  try { await document.fonts.ready; } catch {}
  return {
    fraunces: document.fonts.check("700 60px 'Fraunces'"),
    inter: document.fonts.check("400 16px 'Inter'"),
    jetbrains: document.fonts.check("400 16px 'JetBrains Mono'"),
    geist: document.fonts.check("400 16px 'Geist'"),
  };
});

// Canvas paint check
const canvasInfo = await page.evaluate(() => {
  const cs = Array.from(document.querySelectorAll('canvas'));
  return cs.map(c => {
    const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    let nonEmpty = false;
    try {
      const w = c.width, h = c.height;
      if (w > 0 && h > 0) {
        const d = ctx.getImageData(0, 0, Math.min(w, 200), Math.min(h, 200)).data;
        for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { nonEmpty = true; break; } }
      }
    } catch (e) {}
    return { w: Math.round(r.width), h: Math.round(r.height), painted: nonEmpty, shadow: getComputedStyle(c).filter };
  });
});

// How many mascot imgs, any broken
const imgInfo = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0);
  return { total: imgs.length, broken: broken.length, brokenSrcs: broken.map(b => b.currentSrc || b.src) };
});

console.log(JSON.stringify({ h1Font, h1Weight, bodyFont, fontsLoaded, canvasInfo, imgInfo, errors }, null, 2));
await browser.close();
