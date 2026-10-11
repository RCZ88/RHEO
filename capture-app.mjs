import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = process.argv[2] || '36525';
const OUT = process.argv[3] || 'landing/public/media';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || (await ctx.waitForEvent('page'));
const cdp = await ctx.newCDPSession(page);

async function shoot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const p = path.join(OUT, name + '.png');
  fs.writeFileSync(p, Buffer.from(data, 'base64'));
  const crashed = await page.evaluate(() => document.body.innerText.includes('Something went wrong'));
  console.log('shot', name, fs.statSync(p).size, 'crashed=' + crashed);
}

async function nav(label) {
  const b = page.getByRole('button', { name: label, exact: true }).first();
  await b.click({ force: true, timeout: 8000 });
  await page.waitForTimeout(2500);
}

await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
});
await page.waitForTimeout(1500);
await shoot('app-dashboard');

for (const [label, name] of [
  ['Activity', 'app-activity'],
  ['Penguin Console', 'app-console'],
  ['Lyceum', 'app-learn'],
  ['Insights', 'app-insights'],
  ['Life', 'app-life'],
  ['AI Assistant', 'app-ai'],
]) {
  try { await nav(label); } catch (e) { console.log('navfail', label, e.message.slice(0, 50)); continue; }
  await shoot(name);
}

// mobile
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});
try { await nav('Dashboard'); } catch {}
await page.waitForTimeout(2000);
await shoot('app-mobile');

await browser.close();
console.log('DONE');
