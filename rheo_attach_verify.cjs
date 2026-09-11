const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = __dirname;
const USER_DATA = path.join(APP_DIR, '.tmp_rheo_runtime_profile');
const MAIN_JS = path.join(APP_DIR, 'dist-electron', 'main.cjs');
const ELECTRON = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  if (!fs.existsSync(MAIN_JS) || !fs.existsSync(ELECTRON)) { console.error('missing artifacts'); process.exit(1); }
  if (fs.existsSync(USER_DATA)) fs.rmSync(USER_DATA, { recursive: true, force: true });
  fs.mkdirSync(USER_DATA, { recursive: true });

  const proc = spawn(ELECTRON, ['--remote-debugging-port=9229', MAIN_JS], {
    cwd: APP_DIR,
    env: { ...process.env, ELECTRON_USER_DATA: USER_DATA, ELECTRON_DISABLE_GPU: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stderr.on('data', d => console.log('[APP_ERR]', d.toString().trim()));
  proc.stdout.on('data', d => console.log('[APP]', d.toString().trim()));

  let appPort = null;
  const portPromise = new Promise(resolve => {
    const onData = d => { const m = d.toString().match(/localhost:(\d+)/); if (m) { appPort = parseInt(m[1]); resolve(appPort); } };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => resolve(null), 20000);
  });

  const resolvedAppPort = await portPromise;
  if (!resolvedAppPort) { console.error('no app port'); await proc.kill('SIGTERM'); process.exit(1); }
  await waitForPort(resolvedAppPort);
  await waitForPort(9229);

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9229');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const evidence = await page.evaluate(() => ({
    title: document.title,
    rootCount: document.querySelectorAll('#root').length,
    bodyChildren: document.body.children.length,
    bodyTextLength: document.body.innerText ? document.body.innerText.trim().length : 0,
    bodyTextSnippet: document.body.innerText ? document.body.innerText.trim().slice(0, 300) : '',
    sidebarVisible: !!document.querySelector('[data-sidebar], nav, [class*="sidebar"]'),
    sidebarItems: document.querySelectorAll('nav a, [data-sidebar-item], .sidebar a').length,
  }));

  console.log('EVIDENCE', JSON.stringify(evidence, null, 2));
  const pass = evidence.rootCount > 0 && evidence.bodyTextLength > 50;
  console.log('PASS', pass);

  await browser.close();
  await proc.kill('SIGTERM');
  process.exit(pass ? 0 : 2);
}

main().catch(err => { console.error(err); process.exit(1); });
