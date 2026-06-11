import type { Locator, Page } from '@playwright/test';

export type ScrollBlock = 'center' | 'start' | 'end';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Jump to the top so a post-navigation scroll is one continuous motion (not hash + animate). */
export async function resetScrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await page.waitForTimeout(80);
}

async function resolveScrollTarget(
  locator: Locator,
  block: ScrollBlock,
): Promise<{ startY: number; targetY: number } | null> {
  return locator.evaluate((element, align) => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    const startY = window.scrollY;

    let toY: number;
    if (align === 'center') {
      toY = startY + rect.top - (viewportHeight - rect.height) / 2;
    } else if (align === 'start') {
      toY = startY + rect.top - 80;
    } else {
      toY = startY + rect.bottom - viewportHeight + 80;
    }

    return { startY, targetY: Math.max(0, Math.min(toY, maxScroll)) };
  }, block);
}

/**
 * Animate scroll over a fixed duration for video capture.
 * Target is resolved once up front so the motion is a single uninterrupted glide.
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

  const frameMs = 8;
  const frames = Math.max(1, Math.ceil(durationMs / frameMs));

  for (let frame = 1; frame <= frames; frame += 1) {
    const y = target.startY + distance * easeInOutCubic(frame / frames);
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(frameMs);
  }

  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), target.targetY);
  await page.waitForTimeout(50);
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
