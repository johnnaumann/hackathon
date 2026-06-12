import type { Locator, Page } from '@playwright/test';

export const DEFAULT_HIGHLIGHT_COLOR = '#F5C518';
/** Subtle fill — the ring carries the emphasis so the target stays readable. */
export const DEFAULT_HIGHLIGHT_OPACITY = 0.16;
const TARGET_OVERLAY_ID = 'flow-doc-click-target';
const HIGHLIGHT_STYLE_ID = 'flow-doc-highlight-style';

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
  const ring = hexToRgba(color, 0.95);
  const glow = hexToRgba(color, 0.38);

  await page.evaluate(
    ({ box: rect, fill, ring, glow, pad, targetId, styleId }) => {
      document.getElementById(targetId)?.remove();

      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes flow-doc-highlight-in {
            0% { opacity: 0; transform: scale(1.12); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes flow-doc-highlight-pulse {
            0%, 100% { box-shadow: 0 0 0 4px var(--flow-glow), 0 0 22px 2px var(--flow-glow); }
            50% { box-shadow: 0 0 0 9px var(--flow-glow), 0 0 30px 6px var(--flow-glow); }
          }
        `;
        document.head.append(style);
      }

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
      overlay.style.setProperty('--flow-glow', glow);
      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: `3px solid ${ring}`,
        borderRadius,
        background: fill,
        pointerEvents: 'none',
        zIndex: '2147483645',
        boxSizing: 'border-box',
        animation:
          'flow-doc-highlight-in 240ms ease-out, flow-doc-highlight-pulse 1.6s ease-in-out 240ms infinite',
      });
      document.body.appendChild(overlay);
    },
    { box, fill, ring, glow, pad, targetId: TARGET_OVERLAY_ID, styleId: HIGHLIGHT_STYLE_ID },
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

/** Re-frame the target immediately before click/fill. */
export async function emphasizeClickTarget(
  page: Page,
  locator: Locator,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
  opacity: number = DEFAULT_HIGHLIGHT_OPACITY,
) {
  await refreshClickTarget(page, locator, color, opacity);
}

export async function clearHighlights(page: Page) {
  await page.evaluate((targetId) => {
    document.getElementById(targetId)?.remove();
    document.querySelectorAll('.flow-doc-highlight').forEach((element) => {
      element.classList.remove('flow-doc-highlight');
    });
  }, TARGET_OVERLAY_ID);
}
