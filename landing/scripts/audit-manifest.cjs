#!/usr/bin/env node
const { chromium } = require('/home/clementzhao/dev/rheo/node_modules/playwright');

const MANIFEST_NAMES = [
  'hero-terrain', 'hero-screenshot',
  'sample-day-timeline',
  'gallery-header-reveal',
  'console-typing',
  'ledger-reveal',
  'vault-figure', 'exploded-figure',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const domNames = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-motion]')).map(e => e.getAttribute('data-motion'))
  );

  const missing = MANIFEST_NAMES.filter(n => !domNames.includes(n));
  const extra = domNames.filter(n => !MANIFEST_NAMES.includes(n));

  console.log(`Manifest entries: ${MANIFEST_NAMES.length}`);
  console.log(`DOM data-motion:  ${domNames.length}`);
  console.log(`Missing from DOM: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`Extra in DOM:     ${extra.length ? extra.join(', ') : 'none'}`);

  if (missing.length === 0 && extra.length === 0) {
    console.log('PASS — manifest matches DOM');
  } else {
    console.log('FAIL — manifest does not match DOM');
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
