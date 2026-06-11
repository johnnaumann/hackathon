import type { Locator, Page } from '@playwright/test';

export const DEFAULT_HIGHLIGHT_COLOR = '#F5C518';
/** Uniform fill opacity — keeps the target visible underneath. */
export const DEFAULT_HIGHLIGHT_OPACITY = 0.42;
const TARGET_OVERLAY_ID = 'flow-doc-click-target';

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export async function injectHighlightStyles(_page: Page, _color: string = DEFAULT_HIGHLIGHT_COLOR) {
  // Highlights use inline overlay styles only — no injected CSS needed.
}

type Box = { x: number; y: number; width: number; height: number };

async function resolveTargetBox(locator: Locator): Promise<Box | null> {
  let box = await locator.boundingBox();
  if (!box || box.width < 1 || box.height < 1) {
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    box = await locator.boundingBox();
  }
  if (!box || box.width < 1 || box.height < 1) return null;
  return box;
}

async function paintTargetOverlay(
  page: Page,
  box: Box,
  color: string,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  const pad = 10;
  const fill = hexToRgba(color, opacity);

  await page.evaluate(
    ({ box: rect, fill, pad, targetId }) => {
      document.getElementById(targetId)?.remove();

      const aspect = rect.width / rect.height;
      const isSquareish = aspect >= 0.78 && aspect <= 1.28;

      let left: number;
      let top: number;
      let width: number;
      let height: number;
      let borderRadius: string;

      if (isSquareish) {
        const size = Math.max(rect.width, rect.height) + pad * 2;
        left = rect.x + rect.width / 2 - size / 2;
        top = rect.y + rect.height / 2 - size / 2;
        width = size;
        height = size;
        borderRadius = '50%';
      } else {
        left = rect.x - pad;
        top = rect.y - pad;
        width = rect.width + pad * 2;
        height = rect.height + pad * 2;
        const radius = Math.max(12, Math.min(width, height) * 0.22);
        borderRadius = `${radius}px`;
      }

      const overlay = document.createElement('div');
      overlay.id = targetId;
      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        borderRadius,
        background: fill,
        pointerEvents: 'none',
        zIndex: '2147483647',
        boxSizing: 'border-box',
      });
      document.body.appendChild(overlay);
    },
    { box, fill, pad, targetId: TARGET_OVERLAY_ID },
  );
}

export async function showClickTarget(
  page: Page,
  locator: Locator,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  const box = await resolveTargetBox(locator);
  if (!box) return;
  await paintTargetOverlay(page, box, color, opacity);
}

export async function refreshClickTarget(
  page: Page,
  locator: Locator,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  await showClickTarget(page, locator, color, opacity);
}

export async function markClickTarget(
  page: Page,
  locator: Locator,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  await clearHighlights(page);
  await showClickTarget(page, locator, color, opacity);
}

/** Short beat immediately before click/fill — keeps the target framed. */
export async function emphasizeClickTarget(
  page: Page,
  locator: Locator,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  await refreshClickTarget(page, locator, color, opacity);
  await page.waitForTimeout(200);
}

export async function clearHighlights(page: Page) {
  await page.evaluate((targetId) => {
    document.getElementById(targetId)?.remove();
    document.querySelectorAll('.flow-doc-highlight').forEach((element) => {
      element.classList.remove('flow-doc-highlight');
    });
  }, TARGET_OVERLAY_ID);
}
