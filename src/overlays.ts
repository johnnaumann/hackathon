import type { Page } from '@playwright/test';

export async function dismissCookieBanner(page: Page) {
  const cmp = page.locator('#usercentrics-cmp-ui');
  const usercentrics = page.locator('[data-testid="uc-accept-all-button"]');

  if (await usercentrics.count()) {
    await usercentrics.first().click({ force: true, timeout: 5000 }).catch(() => undefined);
  } else {
    const candidates = [
      page.getByRole('button', { name: /accept all/i }),
      page.getByRole('button', { name: /accept cookies/i }),
    ];
    for (const locator of candidates) {
      if ((await locator.count()) > 0) {
        await locator.first().click({ force: true, timeout: 3000 }).catch(() => undefined);
        break;
      }
    }
  }

  await cmp.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

export async function waitForPageReady(page: Page) {
  await page.getByRole('banner').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
}

export async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  });
}
