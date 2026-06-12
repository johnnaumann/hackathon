import type { Locator, Page } from '@playwright/test';

const CURSOR_ROOT_ID = 'flow-doc-cursor';
const POSITION_KEY = 'flow-doc-cursor-pos';

/** Default glide time towards a click/fill target. */
export const CURSOR_MOVE_MS = 650;
/** Press animation duration — the click fires mid-pulse. */
export const CURSOR_PRESS_MS = 260;

const CURSOR_SVG = `
<svg width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z"
        fill="#1a1a1e" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/**
 * Mount the synthetic cursor if missing (idempotent). Mounted lazily via
 * evaluate rather than an init script — pre-hydration DOM gets wiped by the
 * site's React recovery render. Position persists in sessionStorage so the
 * pointer does not jump after a same-site navigation.
 */
async function ensureCursor(page: Page) {
  await page.evaluate(
    ({ rootId, positionKey, svg }) => {
      if (document.getElementById(rootId)) return;

      let x = window.innerWidth * 0.62;
      let y = window.innerHeight * 0.38;
      try {
        const stored = sessionStorage.getItem(positionKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { x: number; y: number };
          x = parsed.x;
          y = parsed.y;
        }
      } catch {
        /* default position */
      }

      const root = document.createElement('div');
      root.id = rootId;
      root.style.cssText = [
        'position: fixed',
        'left: 0',
        'top: 0',
        'z-index: 2147483647',
        'pointer-events: none',
        'will-change: transform',
        `transform: translate(${x}px, ${y}px)`,
        'filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35))',
        'opacity: 0',
        'transition: opacity 250ms ease-out',
      ].join(';');
      root.innerHTML = svg;
      (root as HTMLElement & { _flowPos?: { x: number; y: number } })._flowPos = { x, y };
      document.body.append(root);
      requestAnimationFrame(() => {
        root.style.opacity = '1';
      });
    },
    { rootId: CURSOR_ROOT_ID, positionKey: POSITION_KEY, svg: CURSOR_SVG },
  );
}

/** Glide the cursor to the centre of the target with an eased rAF animation. */
export async function moveCursorToLocator(
  page: Page,
  locator: Locator,
  durationMs = CURSOR_MOVE_MS,
) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await ensureCursor(page);
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await page.evaluate(
    async ({ rootId, positionKey, targetX, targetY, durationMs }) => {
      const root = document.getElementById(rootId) as
        | (HTMLElement & { _flowPos?: { x: number; y: number } })
        | null;
      if (!root) return;

      const from = root._flowPos ?? { x: window.innerWidth * 0.62, y: window.innerHeight * 0.38 };
      const dx = targetX - from.x;
      const dy = targetY - from.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      const easeInOutCubic = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = easeInOutCubic(t);
          const x = from.x + dx * eased;
          const y = from.y + dy * eased;
          root.style.transform = `translate(${x}px, ${y}px)`;
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            root._flowPos = { x: targetX, y: targetY };
            try {
              sessionStorage.setItem(positionKey, JSON.stringify(root._flowPos));
            } catch {
              /* best effort */
            }
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    },
    { rootId: CURSOR_ROOT_ID, positionKey: POSITION_KEY, targetX, targetY, durationMs },
  );
}

/** Play a click pulse at the cursor hotspot — call right before the actual click. */
export async function pressCursor(page: Page) {
  await page.evaluate(
    ({ rootId, pressMs }) => {
      const root = document.getElementById(rootId) as
        | (HTMLElement & { _flowPos?: { x: number; y: number } })
        | null;
      if (!root) return;
      const pos = root._flowPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      const svg = root.firstElementChild as HTMLElement | null;
      if (svg) {
        svg.style.transformOrigin = '6px 4px';
        svg.style.transition = `transform ${pressMs / 2}ms ease-out`;
        svg.style.transform = 'scale(0.82)';
        setTimeout(() => {
          svg.style.transform = 'scale(1)';
        }, pressMs / 2);
      }

      const ripple = document.createElement('div');
      ripple.style.cssText = [
        'position: fixed',
        `left: ${pos.x + 7}px`,
        `top: ${pos.y + 5}px`,
        'width: 14px',
        'height: 14px',
        'margin: -7px 0 0 -7px',
        'border-radius: 50%',
        'border: 3px solid rgba(26, 26, 30, 0.85)',
        'background: rgba(255, 255, 255, 0.25)',
        'pointer-events: none',
        'z-index: 2147483646',
        `animation: flow-doc-ripple ${pressMs + 160}ms ease-out forwards`,
      ].join(';');

      if (!document.getElementById('flow-doc-ripple-style')) {
        const style = document.createElement('style');
        style.id = 'flow-doc-ripple-style';
        style.textContent = `
          @keyframes flow-doc-ripple {
            0% { transform: scale(0.45); opacity: 0.9; }
            100% { transform: scale(3.1); opacity: 0; }
          }
        `;
        document.head.append(style);
      }

      document.body.append(ripple);
      setTimeout(() => ripple.remove(), pressMs + 220);
    },
    { rootId: CURSOR_ROOT_ID, pressMs: CURSOR_PRESS_MS },
  );
  await page.waitForTimeout(CURSOR_PRESS_MS / 2);
}
