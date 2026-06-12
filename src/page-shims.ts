import type { Page } from '@playwright/test';

/**
 * tsx (esbuild keepNames) compiles named inner functions to `__name(...)` helper
 * calls. Playwright serialises injected functions with toString(), so the helper
 * is missing inside the page and every init script that declares a named inner
 * function dies with "__name is not defined". Define a no-op shim first —
 * as a raw string so the shim itself cannot be transformed.
 */
export async function installPageShims(page: Page) {
  await page.addInitScript({
    content: 'window.__name = window.__name || function (fn) { return fn; };',
  });
}
