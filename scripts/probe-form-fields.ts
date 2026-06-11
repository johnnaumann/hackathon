import { chromium } from '@playwright/test';
import { dismissCookieBanner } from '../src/overlays.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });
await dismissCookieBanner(page);
await page.getByRole('button', { name: 'Open navigation' }).click();
await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();
await page.waitForURL(/service#contact/);
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Send inquiry' }).scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

const fields = await page.evaluate(() => {
  const form = document.querySelector('form') ?? document.body;
  const inputs = [...form.querySelectorAll('input, textarea, select')];
  return inputs.map((el) => ({
    tag: el.tagName,
    type: (el as HTMLInputElement).type,
    id: el.id,
    name: (el as HTMLInputElement).name,
    placeholder: (el as HTMLInputElement).placeholder,
    label: el.labels?.[0]?.textContent?.trim(),
    ariaLabel: el.getAttribute('aria-label'),
    visible: !!(el as HTMLElement).offsetParent,
    rect: el.getBoundingClientRect(),
  }));
});
console.log(JSON.stringify(fields, null, 2));

// test fill + submit (dry run - check if submit triggers navigation or modal)
const email = page.locator('#E-mail\\ address, input[id="E-mail address"]');
await email.click();
await email.pressSequentially('demo@example.com', { delay: 80 });
const msg = page.locator('#Your\\ message, input[id="Your message"]');
await msg.click();
await msg.pressSequentially('I would like more information about your products.', { delay: 60 });
console.log('filled values:', await email.inputValue(), await msg.inputValue());

const buttons = await page.getByRole('button').all();
for (const b of buttons) {
  const name = (await b.getAttribute('aria-label')) || (await b.textContent());
  if (name?.toLowerCase().match(/send|inquiry|submit/)) {
    console.log('BUTTON:', name?.trim(), 'visible:', await b.isVisible());
  }
}

await browser.close();
