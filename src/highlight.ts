import type { Locator } from '@playwright/test';

const HIGHLIGHT_STYLE_ID = 'flow-doc-highlight-style';

export async function injectHighlightStyles(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    id: HIGHLIGHT_STYLE_ID,
    content: `
      .flow-doc-highlight {
        outline: 3px solid #e30613 !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 0 6px rgba(227, 6, 19, 0.2) !important;
        border-radius: 4px;
      }
    `,
  });
}

export async function highlightLocator(locator: Locator) {
  await locator.evaluate((element) => {
    element.classList.add('flow-doc-highlight');
  });
}

export async function clearHighlights(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.flow-doc-highlight').forEach((element) => {
      element.classList.remove('flow-doc-highlight');
    });
  });
}
