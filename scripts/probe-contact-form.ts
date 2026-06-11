import { chromium } from '@playwright/test';
import { dismissCookieBanner, scrollToTop } from '../src/overlays.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });
await dismissCookieBanner(page);
await scrollToTop(page);

console.log('scrollY at home top:', await page.evaluate(() => window.scrollY));

await page.getByRole('button', { name: 'Open navigation' }).click();
await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();
await page.waitForTimeout(3000);

console.log('url:', page.url());
console.log('scrollY after contact:', await page.evaluate(() => window.scrollY));

const formSelectors = [
  'form',
  '[id="contact"]',
  '[id*="contact" i]',
  'input[type="email"]',
  'textarea',
];

for (const sel of formSelectors) {
  const count = await page.locator(sel).count();
  if (count) console.log(sel, count);
}

const headings = await page.getByRole('heading').allTextContents();
console.log('headings:', headings.slice(0, 10));

const contactHeading = page.getByRole('heading', { name: 'Contact', exact: true });
const form = page.locator('form').first();
console.log('contact heading visible:', await contactHeading.isVisible());
console.log('form visible:', await form.isVisible().catch(() => false));
console.log('form box:', await form.boundingBox().catch(() => null));

await page.screenshot({ path: 'output/contact-from-home/debug/probe-contact-form.png' });
await browser.close();
