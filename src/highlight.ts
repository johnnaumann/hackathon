import type { Locator, Page } from '@playwright/test';

export const DEFAULT_HIGHLIGHT_COLOR = '#F5C518';
const TARGET_OVERLAY_ID = 'flow-doc-click-target';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function highlightCss(color: string): string {
  const { r, g, b } = hexToRgb(color);
  return `
    .flow-doc-highlight {
      outline: 4px solid ${color} !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 8px rgba(${r}, ${g}, ${b}, 0.45) !important;
      border-radius: 6px;
    }
    .flow-doc-click-pulse {
      position: fixed;
      width: 64px;
      height: 64px;
      margin-left: -32px;
      margin-top: -32px;
      border: 4px solid ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483646;
      animation: flow-doc-pulse 1s ease-out forwards;
    }
    #${TARGET_OVERLAY_ID} {
      position: fixed;
      pointer-events: none;
      z-index: 2147483645;
      border: 4px solid ${color};
      border-radius: 10px;
      box-shadow:
        0 0 0 6px rgba(${r}, ${g}, ${b}, 0.4),
        0 0 32px rgba(${r}, ${g}, ${b}, 0.55);
      background: rgba(${r}, ${g}, ${b}, 0.18);
      animation: flow-doc-target-pulse 1.1s ease-in-out infinite;
    }
    @keyframes flow-doc-pulse {
      0% { transform: scale(0.35); opacity: 1; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    @keyframes flow-doc-target-pulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(${r}, ${g}, ${b}, 0.4), 0 0 32px rgba(${r}, ${g}, ${b}, 0.55); }
      50% { box-shadow: 0 0 0 10px rgba(${r}, ${g}, ${b}, 0.55), 0 0 48px rgba(${r}, ${g}, ${b}, 0.75); }
    }
  `;
}

export async function injectHighlightStyles(
  page: Page,
  color: string = DEFAULT_HIGHLIGHT_COLOR,
) {
  await page.addStyleTag({ content: highlightCss(color) });
}

export async function highlightLocator(locator: Locator) {
  await locator.evaluate((element) => {
    element.classList.add('flow-doc-highlight');
  });
}

/** Fixed-position box over the target — visible in video regardless of site CSS. */
export async function showClickTarget(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) return;

  const pad = 8;
  await page.evaluate(
    ({ x, y, width, height, pad }) => {
      document.getElementById('flow-doc-click-target')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'flow-doc-click-target';
      overlay.style.left = `${x - pad}px`;
      overlay.style.top = `${y - pad}px`;
      overlay.style.width = `${width + pad * 2}px`;
      overlay.style.height = `${height + pad * 2}px`;
      document.body.appendChild(overlay);
    },
    { x: box.x, y: box.y, width: box.width, height: box.height, pad },
  );
}

export async function showClickPulse(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) return;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.evaluate(({ x, y }) => {
    const pulse = document.createElement('div');
    pulse.className = 'flow-doc-click-pulse';
    pulse.style.left = `${x}px`;
    pulse.style.top = `${y}px`;
    document.body.appendChild(pulse);
    pulse.addEventListener('animationend', () => pulse.remove(), { once: true });
  }, { x: cx, y: cy });
}

/** Outline + overlay on the element the user should interact with. */
export async function markClickTarget(page: Page, locator: Locator) {
  await highlightLocator(locator);
  await showClickTarget(page, locator);
}

export async function emphasizeClickTarget(page: Page, locator: Locator) {
  await showClickPulse(page, locator);
  await page.waitForTimeout(200);
  await showClickPulse(page, locator);
  await page.waitForTimeout(500);
}

export async function clearHighlights(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.flow-doc-highlight').forEach((element) => {
      element.classList.remove('flow-doc-highlight');
    });
    document.querySelectorAll('.flow-doc-click-pulse').forEach((element) => {
      element.remove();
    });
    document.getElementById('flow-doc-click-target')?.remove();
  });
}
