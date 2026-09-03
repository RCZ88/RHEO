import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'design', 'media');
mkdirSync(join(OUT, 'shots'), { recursive: true });
mkdirSync(join(OUT, 'clips'), { recursive: true });

const SECTIONS = [
  'Dashboard',
  'Activity',
  'AI Assistant',
  'Life',
  'Documentation',
  'Learn',
  'Resume',
  'IDE Projects',
  'Finance',
  'Insights',
  'Settings',
  'Guide',
];

const VP = { width: 1280, height: 800 };

async function main() {
  console.log('Connecting to Electron app via CDP...');
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const contexts = browser.contexts();
  if (!contexts.length) {
    console.error('No browser context found');
    process.exit(1);
  }
  const context = contexts[0];
  const pages = context.pages();
  const page = pages[0] || (await context.newPage());

  await page.setViewportSize(VP);
  await page.waitForTimeout(1000);

  // Debug: print all buttons
  const buttons = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    return Array.from(btns).map((b, i) => ({
      index: i,
      text: b.textContent?.trim(),
      className: b.className,
      id: b.id,
    }));
  });
  console.log(`Found ${buttons.length} buttons`);
  for (const b of buttons.slice(0, 30)) {
    console.log(`  [${b.index}] "${b.text}" class="${b.className}"`);
  }

  // Try clicking by exact text using locator
  const results = { screenshots: [], recordings: [] };

  for (const section of SECTIONS) {
    console.log(`\n--- ${section} ---`);

    // Try multiple strategies
    let clicked = false;

    // Strategy 1: getByText exact
    try {
      const loc = page.getByText(section, { exact: true });
      const cnt = await loc.count();
      if (cnt > 0) {
        await loc.first().click({ timeout: 3000 });
        clicked = true;
      }
    } catch (e) {}

    // Strategy 2: locator with text
    if (!clicked) {
      try {
        const loc = page.locator(`text="${section}"`);
        const cnt = await loc.count();
        if (cnt > 0) {
          await loc.first().click({ timeout: 3000 });
          clicked = true;
        }
      } catch (e) {}
    }

    // Strategy 3: CSS selector with class patterns
    if (!clicked) {
      try {
        const loc = page.locator(`[class*="${section.toLowerCase().replace(/\s+/g, '-')}"]`);
        const cnt = await loc.count();
        if (cnt > 0) {
          await loc.first().click({ timeout: 3000 });
          clicked = true;
        }
      } catch (e) {}
    }

    if (!clicked) {
      console.log(`  SKIP: button "${section}" not found`);
      continue;
    }

    await page.waitForTimeout(1500);

    // Screenshot
    const shotPath = join(OUT, 'shots', `${section.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`);
    await page.screenshot({ path: shotPath, fullPage: false, timeout: 15000 });
    console.log(`  screenshot → ${shotPath}`);
    results.screenshots.push({ section, file: shotPath });

    // Recording
    const clipDir = join(OUT, 'clips');
    const ctx2 = await browser.newContext({
      viewport: VP,
      recordVideo: { dir: clipDir, size: VP },
    });
    const page2 = await ctx2.newPage();
    let clicked2 = false;
    try {
      const loc = page2.getByText(section, { exact: true });
      if (await loc.count() > 0) {
        await loc.first().click({ timeout: 3000 });
        clicked2 = true;
      }
    } catch (e) {}
    if (!clicked2) {
      try {
        const loc = page2.locator(`text="${section}"`);
        if (await loc.count() > 0) {
          await loc.first().click({ timeout: 3000 });
          clicked2 = true;
        }
      } catch (e) {}
    }
    if (clicked2) {
      await page2.waitForTimeout(1500);
      const scrollHeight = await page2.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      if (scrollHeight > 0) {
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          await page2.evaluate((y) => window.scrollTo(0, y), (scrollHeight * i) / steps);
          await page2.waitForTimeout(120);
        }
      }
    }
    const clipPath = await page2.video().path();
    const destName = `${section.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`;
    const destPath = join(clipDir, destName);
    const fs = await import('fs/promises');
    await fs.copyFile(clipPath, destPath);
    console.log(`  recording → ${destPath}`);
    results.recordings.push({ section, file: destPath });
    await ctx2.close();
  }

  // Full page screenshot
  const fullPath = join(OUT, 'shots', 'full_page.png');
  await page.screenshot({ path: fullPath, fullPage: true, timeout: 30000 });
  results.screenshots.push({ section: 'full_page', file: fullPath });

  await browser.close();

  writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify(results, null, 2));
  console.log('\n=== DONE ===');
  console.log(`Screenshots: ${results.screenshots.length}`);
  console.log(`Recordings: ${results.recordings.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
