import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '..', 'design', 'media', 'shots');
mkdirSync(OUT, { recursive: true });

const URL = 'http://10.81.99.28:3001';

// Sections to capture — map label → selector (id)
const SECTIONS = [
  { label: 'hero', id: '#hero' },
  { label: 'manifesto', id: '#manifesto' },
  { label: 'act-record', id: '#act-record', scrub: true },
  { label: 'capabilities', id: '#capabilities' },
  { label: 'understand', id: '#understand' },
  { label: 'learn', id: '#learn' },
  { label: 'atlas', id: '#act-flow' }, // atlas absent → act-flow substitute
  { label: 'flow', id: '#act-flow' },
  { label: 'download', id: '#download' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 800 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport ${vp.name} (${vp.width}x${vp.height}) ===`);
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // full page
    const fullPath = join(OUT, `full-${vp.name}.png`);
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`  → full-${vp.name}.png`);
    results.push({ viewport: vp.name, section: 'full', file: fullPath });

    // per-section
    for (const sec of SECTIONS) {
      // check if section exists
      const exists = await page.evaluate((sel) => !!document.querySelector(sel), sec.id);
      if (!exists) {
        console.log(`  SKIP ${sec.label} (${sec.id} not found)`);
        continue;
      }

      // scroll section into view
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, sec.id);
      await page.waitForTimeout(800);

      // mid-scrub for act-record (scroll halfway into the section)
      if (sec.scrub) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const mid = window.scrollY + rect.top + rect.height * 0.5 - window.innerHeight * 0.4;
          window.scrollTo(0, mid);
        }, sec.id);
        await page.waitForTimeout(500);
      }

      // clip to section bounding box
      const box = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
      }, sec.id);

      if (!box || box.width === 0 || box.height === 0) {
        console.log(`  SKIP ${sec.label} (zero box)`);
        continue;
      }

      const safe = sec.label.replace(/[^a-z0-9]/g, '_');
      const path = join(OUT, `${safe}-${vp.name}.png`);
      await page.screenshot({ path, clip: box });
      console.log(`  → ${safe}-${vp.name}.png (${Math.round(box.width)}×${Math.round(box.height)})`);
      results.push({ viewport: vp.name, section: sec.label, file: path });
    }

    await ctx.close();
  }

  await browser.close();

  console.log('\n=== SCREENSHOTS COMPLETE ===');
  console.log(`Total: ${results.length} captures`);
  // write index
  const fs = await import('fs/promises');
  await fs.writeFile(join(OUT, '_index.json'), JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
