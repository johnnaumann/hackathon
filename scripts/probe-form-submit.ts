import { chromium } from '@playwright/test';
import { dismissCookieBanner, scrollToTop } from '../src/overlays.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('https://grimme.com/en/service#contact', { waitUntil: 'domcontentloaded' });
await dismissCookieBanner(page);
await scrollToTop(page);
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Send inquiry' }).scrollIntoViewIfNeeded();

const email = page.locator('input[id="E-mail address"]');
const message = page.locator('input[id="Your message"]');
const zip = page.locator('input[name="zipCode"]');

await dismissCookieBanner(page);
await email.click({ force: true });
await email.pressSequentially('demo@example.com', { delay: 70 });
await message.click({ force: true });
await message.pressSequentially('I would like more information about your machines.', { delay: 50 });

if (await zip.isVisible()) {
  await zip.click({ force: true });
  await zip.pressSequentially('12345', { delay: 60 });
}

const submit = page.getByRole('button', { name: 'Send inquiry' });
await submit.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
console.log('Before submit URL:', page.url());

// Don't actually submit in probe — check required fields
const required = await page.evaluate(() =>
  [...document.querySelectorAll('input, textarea, select')]
    .filter((el) => el.hasAttribute('required') || (el as HTMLInputElement).required)
    .map((el) => ({ id: el.id, name: (el as HTMLInputElement).name, label: el.labels?.[0]?.textContent?.trim() })),
);
console.log('Required fields:', JSON.stringify(required, null, 2));

await submit.click({ force: true });
await page.waitForTimeout(3000);
console.log('After submit URL:', page.url());
const alerts = await page.getByRole('alert').allTextContents();
const status = await page.locator('[role="status"]').allTextContents();
console.log('Alerts:', alerts);
console.log('Status:', status);
console.log('Body snippet:', (await page.locator('body').innerText()).slice(0, 2000));

await browser.close();
