import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '..', 'design', 'media', 'clips');
mkdirSync(OUT, { recursive: true });

const URL = 'http://10.81.99.28:3001';
const VP = { width: 1280, height: 800 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // ──────────────────────────────────────────────
  // (a) Full scroll top → bottom → top (reversibility)
  // ──────────────────────────────────────────────
  {
    console.log('\n[RECORD] (a) full scroll top→bottom→top');
    const ctx = await browser.newContext({
      viewport: VP,
      recordVideo: { dir: OUT, size: VP },
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // top → bottom
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        (scrollHeight * i) / steps,
      );
      await page.waitForTimeout(150);
    }
    // bottom → top
    for (let i = steps; i >= 0; i--) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        (scrollHeight * i) / steps,
      );
      await page.waitForTimeout(150);
    }

    await page.waitForTimeout(500);
    const vp = page.video();
    const path = await vp.path();
    console.log('  →', path);
    results.push({ name: 'a-full-scroll-reverse', file: path });
    await ctx.close();
  }

  // ──────────────────────────────────────────────
  // (b) Hero: violent scroll burst → 2s hold
  // ──────────────────────────────────────────────
  {
    console.log('\n[RECORD] (b) hero violent scroll burst → 2s hold');
    const ctx = await browser.newContext({
      viewport: VP,
      recordVideo: { dir: OUT, size: VP },
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // violent scroll burst (5 fast jumps)
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, max * (0.1 + Math.random() * 0.4));
      });
      await page.waitForTimeout(120);
    }
    // 2s hold
    await page.waitForTimeout(2000);

    const path = await page.video().path();
    console.log('  →', path);
    results.push({ name: 'b-hero-burst-hold', file: path });
    await ctx.close();
  }

  // ──────────────────────────────────────────────
  // (c) Act-record: slow scroll through 300vh scrub
  // ──────────────────────────────────────────────
  {
    console.log('\n[RECORD] (c) act-record slow scroll through scrub');
    const ctx = await browser.newContext({
      viewport: VP,
      recordVideo: { dir: OUT, size: VP },
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // scroll to act-record
    await page.evaluate(() => {
      const el = document.getElementById('act-record');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(800);

    // slow scroll through
    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const startY = await page.evaluate(() => window.scrollY);
    const endY = Math.min(startY + scrollHeight * 0.6, scrollHeight);
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        startY + ((endY - startY) * i) / steps,
      );
      await page.waitForTimeout(180);
    }

    const path = await page.video().path();
    console.log('  →', path);
    results.push({ name: 'c-act-record-scrub', file: path });
    await ctx.close();
  }

  // ──────────────────────────────────────────────
  // (d) Atlas / rail: slow scroll (post-merge)
  // Note: "atlas" absent in landing-mvp-draft;
  // substitute act-flow (closest rail-like section).
  // ──────────────────────────────────────────────
  {
    console.log('\n[RECORD] (d) atlas/rail slow scroll → substituting act-flow');
    const ctx = await browser.newContext({
      viewport: VP,
      recordVideo: { dir: OUT, size: VP },
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const el = document.getElementById('act-flow');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(800);

    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const startY = await page.evaluate(() => window.scrollY);
    const endY = Math.min(startY + scrollHeight * 0.5, scrollHeight);
    const steps = 25;
    for (let i = 0; i <= steps; i++) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        startY + ((endY - startY) * i) / steps,
      );
      await page.waitForTimeout(200);
    }

    const path = await page.video().path();
    console.log('  →', path);
    results.push({ name: 'd-atlas-rail (act-flow-sub)', file: path });
    await ctx.close();
  }

  await browser.close();

  console.log('\n=== RECORDING COMPLETE ===');
  for (const r of results) console.log(`${r.name}  →  ${r.file}`);

  // copy to stable names for manifest
  const fs = await import('fs/promises');
  for (const r of results) {
    const ext = r.file.endsWith('.webm') ? '.webm' : '.mp4';
    const dest = join(OUT, `${r.name}${ext}`);
    await fs.copyFile(r.file, dest);
    console.log(`  copied → ${dest}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
