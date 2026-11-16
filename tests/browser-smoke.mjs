import { chromium } from '@playwright/test';
import { allTools } from '../catalog.js';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const remote = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => {
  if (!new URL(r.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) {
    remote.push(r.url());
  }
});

const base = process.env.TEST_URL || 'http://localhost:4173/';
await page.goto(base);
await page.locator('.cupboard-card').first().waitFor();
if (await page.locator('.cupboard-card').count() !== 6) throw Error('Expected exactly six cupboards');

// Test waffle mascot bounce
await page.locator('#waffle-mascot').click();
await page.locator('#waffle-mascot.is-bouncing').waitFor();
await page.screenshot({ path: '/tmp/bite-home-desktop.png', fullPage: true });

// Open Math & Numbers cupboard and verify exact 10 shelf objects
await page.locator('[data-open-cupboard="math"]').click();
await page.waitForURL('**/#math');
await page.locator('.shelf-object').first().waitFor();
if (await page.locator('.shelf-object').count() !== 10) {
  throw Error('Expected exactly 10 Math & Numbers utilities on shelf');
}
await page.screenshot({ path: '/tmp/bite-math-cupboard.png', fullPage: true });

// Test favorite toggle
await page.locator('[data-fav="calculator"]').first().click();
await page.locator('[data-nav="favorites"]').click();
await page.waitForURL('**/#favorites');
await page.locator('.shelf-object[data-tool="calculator"]').waitFor();

const failures = [];
for (const t of allTools) {
  try {
    await page.goto(base + '#tool/' + t.id);
    await page.waitForFunction(() => {
      const r = document.querySelector('#tool-root');
      return r && !r.textContent.includes('Lifting off the shelf') && r.childElementCount > 0;
    }, { timeout: 15000 });
    const text = await page.locator('#tool-root').innerText();
    if (/could not be opened|Something went wrong|Unable to initialize/.test(text)) failures.push(t.id + ': ' + text);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3);
    if (scroll) failures.push(t.id + ': horizontal overflow');
  } catch (e) {
    failures.push(t.id + ': ' + e.message);
  }
}

// Functional checks on Math & Numbers tools
await page.goto(base + '#tool/calculator');
await page.locator('#tool-root .calc-expr-input').fill('2+3*4');
await page.locator('#tool-root .calc-key.key-eq').click();
if (!(await page.locator('#tool-root .calc-result').innerText()).includes('14')) {
  failures.push('Calculator arithmetic failed');
}

await page.goto(base + '#tool/sequence-playground');
if (await page.locator('#tool-root .seq-tile').count() !== 8) {
  failures.push('Sequence Playground expected 8 tiles');
}
await page.locator('#tool-root .seq-tile').nth(2).click();
if (!(await page.locator('#tool-root .seq-tile').nth(2).evaluate(el => el.classList.contains('is-forward')))) {
  failures.push('Sequence tile did not animate forward');
}

await page.goto(base + '#tool/roman-numerals');
if (!(await page.locator('#tool-root .vinculum').count())) {
  failures.push('Roman numeral vinculum overline missing');
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '#kitchen');
await page.locator('.cupboard-card').first().waitFor();
await page.screenshot({ path: '/tmp/bite-home-mobile.png', fullPage: true });
if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) {
  failures.push('Mobile home horizontal overflow');
}

await browser.close();
const result = { toolsChecked: allTools.length, failures, pageErrors: errors, externalRequests: [...new Set(remote)] };
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync('/tmp/bite-browser-result.json', JSON.stringify(result, null, 2));
if (failures.length || errors.length || remote.length) process.exitCode = 1;
