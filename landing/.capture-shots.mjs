import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = 'design/media/shots';
fs.mkdirSync(outDir, { recursive: true });

const sections = [
  { id: 'hero', label: 'hero' },
  { id: 'manifesto', label: 'manifesto' },
  { id: 'act-record', label: 'act-record' },
  { id: 'capabilities', label: 'capabilities' },
  { id: 'understand', label: 'understand' },
  { id: 'learn', label: 'learn' },
  { id: 'atlas', label: 'atlas' },
  { id: 'flow', label: 'flow' },
  { id: 'download', label: 'download' },
];

async function captureViewport(width, height, prefix) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  
  // Full page screenshot
  await page.screenshot({ path: path.join(outDir, `${prefix}_full.png`), fullPage: true });
  
  // Per-section screenshots
  for (const sec of sections) {
    const el = await page.locator(`#${sec.id}`);
    if (await el.count() > 0) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${prefix}_${sec.label}.png`) });
    }
  }
  
  await browser.close();
  console.log(`Done ${prefix}`);
}

(async () => {
  await captureViewport(1280, 800, 'shot_1280');
  await captureViewport(375, 800, 'shot_375');
  console.log('All screenshots captured');
})();
