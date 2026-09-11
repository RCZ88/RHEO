// verify-electron.cjs — cold-launch Electron, assert healed state, screenshot
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.resolve(APP_DIR, 'docs/verify');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'app-healed.png');

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Kill any previous verify electron (not user's app instances)
try {
  const victim = spawn('tasklist.exe', ['/FI', 'IMAGENAME eq electron.exe', '/FO', 'CSV', '/NH'], { cwd: APP_DIR, shell: true });
  // We won't kill user's app — just note them
  console.log('[verify] User electron instances observed; verify will launch its own.');
} catch(e) {}

// Install playwright browsers if missing
try {
  execSync('npx playwright install chromium', { cwd: APP_DIR, stdio: 'inherit', timeout: 120000 });
} catch(e) {
  console.error('[verify] playwright install failed:', e.message);
  process.exit(1);
}

const { _electron } = require('playwright');

async function main() {
  console.log('[verify] Launching Electron...');
  const app = await _electron.launch({
    executablePath: path.join(APP_DIR, 'node_modules/electron/dist/electron.exe'),
    args: [APP_DIR],
    timeout: 30000,
  });

  const page = await app.firstPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  // Wait for boot
  await page.waitForTimeout(5000);

  // Assert 1: root container class list contains CLOSED bg-[#121212]
  const rootClass = await page.evaluate(() => {
    const root = document.querySelector('div'); // the root div
    return root ? root.className : '';
  });
  console.log('[verify] Root className:', rootClass);
  const hasClosedBg = rootClass.includes('bg-[#121212]');
  const hasTextWhite = rootClass.includes('text-white');
  const hasFlexCol = rootClass.includes('flex-col');
  console.log('[verify] bg-[#121212] CLOSED:', hasClosedBg);
  console.log('[verify] text-white present:', hasTextWhite);
  console.log('[verify] flex-col present:', hasFlexCol);

  // Assert 2: dashboard four cards height > 100px
  const cardHeights = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="GlareHover"], [class*="rounded-xl"]');
    return Array.from(cards).slice(0, 8).map(el => el.getBoundingClientRect().height);
  });
  console.log('[verify] Card heights:', cardHeights);
  const tallCards = cardHeights.filter(h => h > 100);
  console.log('[verify] Cards > 100px:', tallCards.length, 'of', cardHeights.length);

  // Assert 3: #df-fallback absent or hidden
  const dfFallback = await page.$('#df-fallback');
  const dfHidden = dfFallback ? (await dfFallback.evaluate(el => el.offsetParent === null || el.style.display === 'none')) : true;
  console.log('[verify] #df-fallback absent-or-hidden:', dfHidden);

  // Assert 4: console clean (only pre-existing known errors allowed)
  const bootErrors = errors.filter(e => !e.includes('RAGService') && !e.includes('test/main'));
  console.log('[verify] Console errors (excluding documented debt):', bootErrors.length);
  if (bootErrors.length) console.log('[verify] Errors:', bootErrors.slice(0,5));

  // Screenshot
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log('[verify] Screenshot saved:', SCREENSHOT_PATH);

  // Report
  const passed = hasClosedBg && hasTextWhite && hasFlexCol && tallCards.length >= 4 && dfHidden && bootErrors.length === 0;
  console.log('\n[verify] =========================');
  console.log('[verify] ALL ASSERTIONS:', passed ? 'PASS' : 'FAIL');
  console.log('[verify] =========================');

  await app.close();
  process.exit(passed ? 0 : 1);
}

main().catch(e => { console.error('[verify] FATAL:', e); process.exit(1); });
