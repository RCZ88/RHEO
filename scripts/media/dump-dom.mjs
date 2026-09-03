import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'design', 'media');
mkdirSync(join(OUT, 'shots'), { recursive: true });
mkdirSync(join(OUT, 'clips'), { recursive: true });

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

  // Dump full DOM
  const dom = await page.content();
  writeFileSync(join(OUT, 'page_dom.html'), dom);
  console.log(`DOM saved (${dom.length} chars)`);

  // Save current screenshot for reference
  await page.screenshot({ path: join(OUT, 'shots', 'current_state.png'), fullPage: false });
  console.log('Current state screenshot saved');

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
