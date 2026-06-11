import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { flowDebugPath, getFlowOutputDir } from '../src/flow-paths.js';

const flowFile = process.argv[2] ?? 'contact-from-home.yaml';
const outputDir = await getFlowOutputDir(flowFile);
const debugDir = path.join(outputDir, 'debug');
await mkdir(debugDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const uc = page.locator('[data-testid="uc-accept-all-button"]');
if (await uc.count()) await uc.click({ force: true });
else await page.getByRole('button', { name: /accept all/i }).first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1000);

await page.getByRole('button', { name: 'Open navigation' }).click();
await page.waitForTimeout(800);

const dialog = page.getByRole('dialog');
console.log('dialog count', await dialog.count());

const menuContact = dialog.getByRole('link', { name: 'Contact' });
console.log('menu contact', await menuContact.count(), await menuContact.first().getAttribute('href'));

await menuContact.first().click();
await page.waitForTimeout(2500);
console.log('final url', page.url());

const headings = await page.getByRole('heading').allTextContents();
console.log('headings', headings.slice(0, 8));

const screenshotPath = flowDebugPath(outputDir, 'probe-menu.png');
await page.screenshot({ path: screenshotPath });
console.log('screenshot →', screenshotPath);

await browser.close();
