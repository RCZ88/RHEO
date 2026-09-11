const { electron: electronPw } = require('playwright');
const path = require('path');

(async () => {
  const projectPath = process.argv[1];
  const shotsDir = process.argv[2];
  const clipsDir = process.argv[3];

  const app = await electronPw.launch({
    args: [projectPath],
  });
  const page = await app.firstWindow();

  await page.setViewportSize({ width: 1280, height: 800 });

  // Wait for app to render
  await page.waitForTimeout(4000);

  async function shot(name) {
    const p = path.join(shotsDir, name + '.png');
    await page.screenshot({ path: p, fullPage: false });
    console.log('shot: ' + name);
  }

  async function videoClip(name, fn, ms = 10000) {
    const p = path.join(clipsDir, name + '.webm');
    await page.video.startRecording({ path: p });
    await fn(page);
    await page.waitForTimeout(ms);
    await page.video.stopRecording();
    console.log('clip: ' + name);
  }

  // --- Screenshots ---
  await shot('app-1280x800');

  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(500);
  await shot('app-375x800');

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.waitForTimeout(500);
  await shot('app-og-hero');

  await page.setViewportSize({ width: 1280, height: 800 });

  // --- Recordings ---
  await videoClip('app-idle-10s', async (p) => {
    // just hold the frame for 10s
  }, 10000);

  console.log('DONE');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
