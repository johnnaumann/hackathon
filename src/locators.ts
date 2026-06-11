import type { Locator, Page } from '@playwright/test';
import type { LocatorSpec } from './types.js';

type LocatorRoot = Page | Locator;

function resolveOn(root: LocatorRoot, spec: LocatorSpec): Locator {
  const scope = spec.within ? resolveOn(root, spec.within) : root;

  if ('css' in spec) {
    return scope.locator(spec.css);
  }

  if ('text' in spec) {
    return scope.getByText(spec.text, { exact: spec.exact ?? false });
  }

  return scope.getByRole(spec.role as Parameters<Page['getByRole']>[0], {
    name: spec.name,
    exact: spec.exact ?? false,
  });
}

export function resolveLocator(page: Page, spec: LocatorSpec): Locator {
  return resolveOn(page, spec);
}
