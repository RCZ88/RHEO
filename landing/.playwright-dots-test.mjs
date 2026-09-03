import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  
  // Find the first SectionIndex dot MARK (the moving part)
  const mark = await page.locator('.si-dot-mark').first();
  const markBox = await mark.boundingBox();
  console.log('Mark initial bbox:', JSON.stringify(markBox));
  
  // Move mouse to 10px from mark center
  const markCenterX = markBox.x + markBox.width / 2;
  const markCenterY = markBox.y + markBox.height / 2;
  const mouseX = markCenterX + 10;
  const mouseY = markCenterY;
  
  await page.mouse.move(mouseX, mouseY);
  await page.waitForTimeout(800);
  
  const markBoxAfter = await mark.boundingBox();
  console.log('Mark after hover bbox:', JSON.stringify(markBoxAfter));
  
  const afterCenterX = markBoxAfter.x + markBoxAfter.width / 2;
  const afterCenterY = markBoxAfter.y + markBoxAfter.height / 2;
  const deltaX = Math.abs(afterCenterX - markCenterX);
  const deltaY = Math.abs(afterCenterY - markCenterY);
  const pixelDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  console.log(`Pixel delta: ${pixelDelta.toFixed(2)}px`);
  
  // Check parent dot label visibility
  const dot = await page.locator('.si-dot').first();
  const label = await dot.locator('.si-dot-label').first();
  const labelOpacity = await label.evaluate(el => window.getComputedStyle(el).opacity);
  console.log('Label opacity:', labelOpacity);
  const labelVisible = parseFloat(labelOpacity) > 0;
  console.log('Label visible:', labelVisible);
  
  // Test click-scroll
  await dot.click();
  await page.waitForTimeout(500);
  const scrollYAfterClick = await page.evaluate(() => window.scrollY);
  console.log('ScrollY after click:', scrollYAfterClick);
  
  // Results
  const needsTune = pixelDelta < 2 || !labelVisible;
  console.log('Needs tune:', needsTune);
  
  if (needsTune) {
    console.log('Tuning: radius 24→32px, pull cap 4→6px, bloom .08→.16');
  }
  
  await browser.close();
})();
