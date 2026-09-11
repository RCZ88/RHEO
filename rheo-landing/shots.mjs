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
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shot-hero.png' });

// scroll to Threads section (where a warp is active + glowing)
const threads = await page.$('#threads');
if (threads) { await threads.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); }
await page.screenshot({ path: 'shot-threads.png' });

// scroll to Shuttle
const shuttle = await page.evaluate(() => {
  const secs = document.querySelectorAll('section');
  for (const s of secs) { if (s.textContent && s.textContent.includes('Flags a subscription')) { s.scrollIntoView(); return true; } }
  return false;
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shot-shuttle.png' });
console.log('done; threads found:', !!threads, 'shuttle scrolled:', shuttle);
await browser.close();
