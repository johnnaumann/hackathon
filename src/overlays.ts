import type { Page } from '@playwright/test';

async function isCmpInDom(page: Page): Promise<boolean> {
  return (await page.locator('#usercentrics-cmp-ui').count()) > 0;
}

export async function isCookieBannerBlocking(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cmp = document.querySelector('#usercentrics-cmp-ui');
    if (!cmp) return false;
    const style = getComputedStyle(cmp);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = cmp.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

async function removeCookieBannerFromDom(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('#usercentrics-cmp-ui')?.remove();
  });
}

/**
 * Wait for and dismiss the Usercentrics CMP once after navigation.
 * Clicking accept scrolls the page ~3500px — always scroll back to top after.
 * Call only during initial page load (pre-roll), not on every step.
 */
export async function waitAndDismissCookieBanner(page: Page): Promise<void> {
  const cmp = page.locator('#usercentrics-cmp-ui');

  for (let i = 0; i < 10; i++) {
    if ((await isCookieBannerBlocking(page)) || (await cmp.isVisible().catch(() => false))) {
      break;
    }
    await page.waitForTimeout(300);
  }

  if (!(await isCookieBannerBlocking(page)) && !(await isCmpInDom(page))) {
    return;
  }

  const accept = page.locator('[data-testid="uc-accept-all-button"]');
  if (await accept.isVisible().catch(() => false)) {
    await accept.click({ force: true, timeout: 5000 }).catch(() => undefined);
  } else {
    await page.evaluate(() => {
      (document.querySelector('[data-testid="uc-accept-all-button"]') as HTMLElement)?.click();
    });
  }

  await cmp.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => undefined);
  await removeCookieBannerFromDom(page);
  await ensureAtTop(page);
}

/**
 * Removes a leftover CMP node from the DOM. Never scrolls the page — scrolling
 * to top here was causing the form section to bounce out of view on every step.
 */
export async function clearCmpOverlay(page: Page): Promise<void> {
  if (await isCmpInDom(page)) {
    await removeCookieBannerFromDom(page);
  }
}

/** Keep the contact form block in a stable viewport position during fill steps. */
export async function ensureFormInView(page: Page): Promise<void> {
  await page.evaluate(() => {
    const form = document.querySelector('[data-sentry-source-file="contact-form-content.tsx"]');
    if (!form) return;
    const rect = form.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 100;
    if (rect.top >= margin && rect.bottom <= viewportHeight - margin) return;

    const targetTop = viewportHeight * 0.12;
    window.scrollBy({ top: rect.top - targetTop, behavior: 'instant' as ScrollBehavior });
  });
}

export async function waitForPageReady(page: Page) {
  await page.getByRole('banner').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
}

export async function ensureAtTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

/** @deprecated Use waitAndDismissCookieBanner or clearCmpOverlay */
export async function dismissCookieBanner(page: Page) {
  await waitAndDismissCookieBanner(page);
}

/** @deprecated Use clearCmpOverlay */
export async function ensureCookieBannerGone(page: Page) {
  await clearCmpOverlay(page);
}

/** @deprecated Use ensureAtTop */
export async function scrollToTop(page: Page) {
  await ensureAtTop(page);
}
