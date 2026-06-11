import type { Locator, Page } from '@playwright/test';

type ScrollBlock = 'center' | 'start' | 'end';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Animate scroll over a fixed duration so video capture feels deliberate, not jumpy.
 * Scroll is driven from Node in ~60fps steps to avoid brittle in-page async scripts.
 */
export async function smoothScrollToLocator(
  page: Page,
  locator: Locator,
  durationMs: number,
  block: ScrollBlock = 'center',
) {
  const { startY, targetY } = await locator.evaluate((element, block) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    const fromY = window.scrollY;

    let toY: number;
    if (block === 'center') {
      toY = fromY + rect.top - (viewportHeight - rect.height) / 2;
    } else if (block === 'start') {
      toY = fromY + rect.top - 24;
    } else {
      toY = fromY + rect.bottom - viewportHeight + 24;
    }

    toY = Math.max(0, Math.min(toY, maxScroll));
    return { startY: fromY, targetY: toY };
  }, block);

  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;

  const frameMs = 16;
  const frames = Math.max(1, Math.ceil(durationMs / frameMs));

  for (let frame = 1; frame <= frames; frame += 1) {
    const progress = easeInOutCubic(frame / frames);
    const y = startY + distance * progress;
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(frameMs);
  }

  await page.waitForTimeout(200);
}

/** Scale scroll duration by distance — short hops stay quick, long page scrolls take longer. */
export function scrollDurationForDistance(distancePx: number, baseMs: number): number {
  const minMs = baseMs;
  const maxMs = baseMs * 2;
  const scaled = baseMs + (Math.abs(distancePx) / 800) * baseMs;
  return Math.round(Math.min(maxMs, Math.max(minMs, scaled)));
}

export async function measureScrollDistance(page: Page, locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const targetY = window.scrollY + rect.top - (viewportHeight - rect.height) / 2;
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    const clamped = Math.max(0, Math.min(targetY, maxScroll));
    return clamped - window.scrollY;
  });
}
