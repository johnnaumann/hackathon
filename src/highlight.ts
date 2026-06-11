import type { Locator, Page } from '@playwright/test';

const HIGHLIGHT_STYLE_ID = 'flow-doc-highlight-style';
export const DEFAULT_HIGHLIGHT_COLOR = '#F5C518';

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
      outline: 3px solid ${color} !important;
      outline-offset: 4px !important;
      box-shadow: 0 0 0 6px rgba(${r}, ${g}, ${b}, 0.3) !important;
      border-radius: 4px;
    }
    .flow-doc-click-pulse {
      position: fixed;
      width: 48px;
      height: 48px;
      margin-left: -24px;
      margin-top: -24px;
      border: 3px solid ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483646;
      animation: flow-doc-pulse 0.75s ease-out forwards;
    }
    @keyframes flow-doc-pulse {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
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

export async function clearHighlights(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.flow-doc-highlight').forEach((element) => {
      element.classList.remove('flow-doc-highlight');
    });
    document.querySelectorAll('.flow-doc-click-pulse').forEach((element) => {
      element.remove();
    });
  });
}
