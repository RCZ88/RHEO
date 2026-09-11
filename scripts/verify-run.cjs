const { _electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve('docs/verify');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'app-healed.png');
const APP_DIR = path.resolve('.');

(async () => {
  console.log('[verify] Launching Electron...');
  const app = await _electron.launch({
    executablePath: path.join('node_modules', 'electron', 'dist', 'electron.exe'),
    args: [APP_DIR],
    timeout: 30000,
  });
  const page = await app.firstPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  await page.waitForTimeout(6000);
  const rootClass = await page.evaluate(() => document.querySelector('div')?.className || '');
  console.log('[verify] Root className:', rootClass);
  const hasClosed = rootClass.includes('bg-[#121212]');
  const hasTextWhite = rootClass.includes('text-white');
  const hasFlexCol = rootClass.includes('flex-col');
  console.log('[verify] bg-[#121212] CLOSED:', hasClosed);
  console.log('[verify] text-white:', hasTextWhite);
  console.log('[verify] flex-col:', hasFlexCol);
  const heights = await page.evaluate(() => Array.from(document.querySelectorAll('[class*=GlareHover], [class*=rounded-xl]')).slice(0,8).map(e => e.getBoundingClientRect().height));
  console.log('[verify] Card heights:', heights);
  const tall = heights.filter(h => h > 100).length;
  console.log('[verify] Cards >100px:', tall);
  const df = await page.$('#df-fallback');
  const dfHidden = df ? (await df.evaluate(el => el.offsetParent === null || el.style.display === 'none')) : true;
  console.log('[verify] #df-fallback hidden:', dfHidden);
  const bootErrs = errors.filter(e => !e.includes('RAGService') && !e.includes('test/main'));
  console.log('[verify] Console errors (excl debt):', bootErrs.length, bootErrs.slice(0,3));
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log('[verify] Screenshot:', SCREENSHOT_PATH);
  const pass = hasClosed && hasTextWhite && hasFlexCol && tall >= 4 && dfHidden && bootErrs.length === 0;
  console.log('[verify] ALL ASSERTIONS:', pass ? 'PASS' : 'FAIL');
  await app.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('[verify] FATAL:', e.message); process.exit(1); });
