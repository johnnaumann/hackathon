import type { Page } from '@playwright/test';

export async function dismissCookieBanner(page: Page) {
  const usercentrics = page.locator('[data-testid="uc-accept-all-button"]');
  if (await usercentrics.count()) {
    await usercentrics.first().click({ force: true, timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return;
  }

  const candidates = [
    page.getByRole('button', { name: /accept all/i }),
    page.getByRole('button', { name: /accept cookies/i }),
    page.getByRole('button', { name: /^accept$/i }),
  ];

  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().click({ force: true, timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      return;
    }
  }
}

export async function waitForPageReady(page: Page) {
  await page.locator('header').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

export async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(150);
}
