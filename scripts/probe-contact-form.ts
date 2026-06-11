import { chromium } from '@playwright/test';
import { enableBrowserChrome } from '../src/browser-chrome.js';
import { dismissCookieBanner, scrollToTop } from '../src/overlays.js';
import { smoothScrollToLocator } from '../src/smooth-scroll.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await enableBrowserChrome(page);
await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });
await dismissCookieBanner(page);
await scrollToTop(page);
console.log('home scrollY', await page.evaluate(() => window.scrollY));

await page.getByRole('button', { name: 'Open navigation' }).click();
await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();
await page.waitForURL(/service#contact/);
await page.waitForTimeout(1500);
console.log('after contact click scrollY', await page.evaluate(() => window.scrollY));

const sendInquiry = page.getByRole('button', { name: 'Send inquiry' });
await sendInquiry.waitFor({ state: 'visible', timeout: 10000 });
console.log('send inquiry box before scroll', await sendInquiry.boundingBox());

await smoothScrollToLocator(page, sendInquiry, 3500);
console.log('after smooth scroll scrollY', await page.evaluate(() => window.scrollY));
console.log('send inquiry box after scroll', await sendInquiry.boundingBox());

await browser.close();
