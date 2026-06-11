import { expect, test } from '@playwright/test';
import { dismissCookieBanner } from '../src/overlays.js';
import { injectHighlightStyles } from '../src/highlight.js';

test('grimme: home to contact via menu', async ({ page }) => {
  await injectHighlightStyles(page);
  await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Contact' }).click();

  await expect(page.getByRole('heading', { name: 'Contact', exact: true })).toBeVisible();
});
