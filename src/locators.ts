import type { Locator, Page } from '@playwright/test';
import type { LocatorSpec } from './types.js';

export function resolveLocator(page: Page, spec: LocatorSpec): Locator {
  if ('css' in spec) {
    return page.locator(spec.css);
  }

  if ('text' in spec) {
    return page.getByText(spec.text, { exact: spec.exact ?? false });
  }

  return page.getByRole(spec.role as Parameters<Page['getByRole']>[0], {
    name: spec.name,
    exact: spec.exact ?? false,
  });
}
