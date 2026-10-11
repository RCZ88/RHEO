import { _electron as electron } from 'playwright';
import fs from 'fs';

const OUT = '/tmp/opencode/site';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const app = await electron.launch({
  executablePath: 'node_modules/electron/dist/electron',
  args: ['/tmp/opencode/shot-main.cjs'],
  cwd: process.cwd(),
});
const page = await app.firstWindow();
const cdp = await app.context().newCDPSession(page);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(6000);

const shots = [
  ['01-hero', 0],
  ['02-manifesto-record', 1],
  ['03-capabilities', 2],
  ['04-understand', 3],
  ['05-learn', 4],
  ['06-download', 5],
];

const found = { images: 0, videos: 0, broken: [], simulated: false };

for (const [name, idx] of shots) {
  await page.evaluate((i) => window.scrollTo({ top: i * window.innerHeight * 1.05, behavior: 'instant' }), idx);
  await page.waitForTimeout(3500);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));

  if (idx === 0) {
    const m = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].filter(i => i.src.includes('/media/'));
      const vids = [...document.querySelectorAll('video')].filter(v => v.src.includes('/media/'));
      return {
        images: imgs.map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight })),
        videos: vids.map(v => ({ src: v.getAttribute('src'), poster: v.getAttribute('poster') })),
        simulated: /SIMULATED RECORD SHOWN/i.test(document.body.innerText),
      };
    });
    found.images = m.images.length;
    found.videos = m.videos.length;
    found.simulated = m.simulated;
    found.detail = m;
  }
}

// full inventory across the whole document
found.all = await page.evaluate(() => ({
  images: [...document.querySelectorAll('img[src*="/media/"]')].map(i => i.getAttribute('src')),
  videos: [...document.querySelectorAll('video[src*="/media/"]')].map(v => v.getAttribute('src')),
  brokenImgs: [...document.querySelectorAll('img[src*="/media/"]')]
    .filter(i => !i.complete || i.naturalWidth === 0)
    .map(i => i.getAttribute('src')),
  simulated: /SIMULATED RECORD SHOWN/i.test(document.body.innerText),
}));

console.log(JSON.stringify(found, null, 2));
await app.close();