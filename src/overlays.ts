import type { Page } from '@playwright/test';

export async function dismissCookieBanner(page: Page) {
  const candidates = [
    page.getByRole('button', { name: /accept all/i }),
    page.getByRole('button', { name: /accept cookies/i }),
    page.getByRole('button', { name: /^accept$/i }),
  ];

  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    }
  }
}
