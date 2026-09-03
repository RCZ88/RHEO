import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  
  // Scroll down to manifesto
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(300);
  
  // Check last word opacity at p=0.75
  const dataDown = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('#manifesto h2 > span'));
    const last = spans[spans.length - 1];
    const computed = window.getComputedStyle(last);
    return { scrollY: window.scrollY, opacity: parseFloat(computed.opacity) };
  });
  console.log('At scrollY=1200 (forward):', dataDown);
  
  // Scroll back up to check un-reveal
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  
  const dataUp = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('#manifesto h2 > span'));
    const last = spans[spans.length - 1];
    const computed = window.getComputedStyle(last);
    return { scrollY: window.scrollY, opacity: parseFloat(computed.opacity) };
  });
  console.log('At scrollY=800 (reverse):', dataUp);
  
  // Verify reversibility: opacity should decrease when scrolling back up
  const reversible = dataDown.opacity > dataUp.opacity;
  console.log('Un-reveal clean on reverse:', reversible);
  
  await browser.close();
})();
