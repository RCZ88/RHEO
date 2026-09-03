import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = 'design/media/clips';
fs.mkdirSync(outDir, { recursive: true });

async function captureClip(name, actions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ 
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 800 } }
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  
  await actions(page);
  
  await context.close();
  await browser.close();
  
  // Rename the newly created video
  const files = fs.readdirSync(outDir);
  const webm = files.find(f => f.endsWith('.webm') && !f.startsWith(name));
  if (webm) {
    const src = path.join(outDir, webm);
    const dst = path.join(outDir, `${name}.webm`);
    fs.renameSync(src, dst);
    console.log(`✓ ${name}.webm`);
  } else {
    console.log(`✗ ${name} — no webm found`);
  }
}

(async () => {
  await captureClip('full_reversibility', async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);
  });
  
  await captureClip('hero_scroll_burst', async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
  });
  
  await captureClip('manifesto_reveal', async (page) => {
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(2000);
  });
  
  await captureClip('dots_hover_desktop', async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const dot = await page.locator('.si-dot').first();
    const box = await dot.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx + 32, cy);
    await page.waitForTimeout(1500);
    await page.mouse.move(cx + 200, cy);
    await page.waitForTimeout(500);
  });
  
  await captureClip('dots_hover_mobile', async (page) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const dot = await page.locator('.si-dot').first();
    const box = await dot.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx + 32, cy);
      await page.waitForTimeout(1500);
      await page.mouse.move(cx + 200, cy);
      await page.waitForTimeout(500);
    }
  });
  
  console.log('All clips captured');
})();
