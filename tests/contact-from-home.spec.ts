import { expect, test } from '@playwright/test';
import { clearHighlights, highlightLocator, injectHighlightStyles } from '../src/highlight.js';

test('grimme: home to contact form', async ({ page }) => {
  await injectHighlightStyles(page);

  await page.goto('https://grimme.com/en', { waitUntil: 'domcontentloaded' });

  const acceptCookies = page.getByRole('button', { name: /accept/i });
  if (await acceptCookies.count()) {
    await acceptCookies.first().click();
  }

  const contactSection = page.getByRole('heading', { name: 'Your direct line to us' });
  await contactSection.scrollIntoViewIfNeeded();
  await highlightLocator(contactSection);

  const openForm = page.getByRole('link', { name: 'Open form' });
  await highlightLocator(openForm);
  await openForm.click();

  await expect(page.getByRole('heading', { name: 'Your Service - Contacts' })).toBeVisible();
});
