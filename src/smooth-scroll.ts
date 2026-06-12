import type { Locator, Page } from '@playwright/test';

export type ScrollBlock = 'center' | 'start' | 'end';

/**
 * Viewport-top offset for `block: start` as a fraction of viewport height.
 * Must match ensureFormInView's anchor — a mismatch means the next fill step
 * "corrects" the position with a visible jump right after the smooth scroll.
 */
export const SCROLL_START_ANCHOR = 0.12;

/** Jump to the top so a post-navigation scroll is one continuous motion (not hash + animate). */
export async function resetScrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(80);
}

/**
 * Pin the viewport to the top across an in-app navigation. SPA route changes
 * with a hash (e.g. /service#contact) natively jump straight to the anchor,
 * which records as an abrupt cut — the lock snaps any such scroll back to 0
 * until released, so the eased scroll afterwards is the only motion on screen.
 */
export async function lockScrollToTop(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __flowScrollLock?: () => void };
    if (w.__flowScrollLock) return;
    const handler = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    w.__flowScrollLock = handler;
    window.addEventListener('scroll', handler);
    window.scrollTo(0, 0);
  });
}

export async function releaseScrollLock(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __flowScrollLock?: () => void };
    if (!w.__flowScrollLock) return;
    window.removeEventListener('scroll', w.__flowScrollLock);
    delete w.__flowScrollLock;
  });
}

async function resolveScrollTarget(
  locator: Locator,
  block: ScrollBlock,
): Promise<{ startY: number; targetY: number } | null> {
  return locator.evaluate(
    (element, { align, startAnchor }) => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const maxScroll = document.documentElement.scrollHeight - viewportHeight;
      const startY = window.scrollY;

      let toY: number;
      if (align === 'center') {
        toY = startY + rect.top - (viewportHeight - rect.height) / 2;
      } else if (align === 'start') {
        toY = startY + rect.top - Math.round(viewportHeight * startAnchor);
      } else {
        toY = startY + rect.bottom - viewportHeight + 80;
      }

      return { startY, targetY: Math.max(0, Math.min(toY, maxScroll)) };
    },
    { align: block, startAnchor: SCROLL_START_ANCHOR },
  );
}

/**
 * Animate scroll over a fixed duration for video capture. The animation runs
 * entirely in-page on requestAnimationFrame — driving it from Node (one
 * evaluate per frame) stutters with CDP round-trip jitter.
 */
export async function smoothScrollToLocator(
  page: Page,
  locator: Locator,
  durationMs: number,
  block: ScrollBlock = 'center',
) {
  const target = await resolveScrollTarget(locator, block);
  if (!target) return;

  const distance = target.targetY - target.startY;
  if (Math.abs(distance) < 40) return;

  await page.evaluate(
    async ({ targetY, durationMs }) => {
      const startY = window.scrollY;
      const dist = targetY - startY;
      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          window.scrollTo(0, startY + dist * easeInOutCubic(t));
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    },
    { targetY: target.targetY, durationMs },
  );

  await page.waitForTimeout(60);
}

/** Scale scroll duration by distance — capped so long page scrolls stay snappy on video. */
export function scrollDurationForDistance(distancePx: number, baseMs: number): number {
  const abs = Math.abs(distancePx);
  if (abs < 40) return 0;

  const effectiveBase = Math.min(baseMs, 2_200);
  const minMs = 800;
  const maxMs = Math.min(2_600, Math.round(effectiveBase * 1.15));
  const scaled = effectiveBase + (abs / 1_200) * effectiveBase * 0.35;
  return Math.round(Math.min(maxMs, Math.max(minMs, scaled)));
}

export async function measureScrollDistance(
  page: Page,
  locator: Locator,
  block: ScrollBlock = 'center',
): Promise<number> {
  const target = await resolveScrollTarget(locator, block);
  if (!target) return 0;
  return target.targetY - target.startY;
}
