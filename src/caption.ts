import type { Page } from '@playwright/test';

const CAPTION_ROOT_ID = 'flow-doc-caption-root';

function stripMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}

export async function showStepCaption(
  page: Page,
  stepNumber: number,
  title: string,
  description: string,
  totalSteps?: number,
) {
  const body = stripMarkdown(description)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  await page.evaluate(
    ({ rootId, stepNumber, totalSteps, title, body }) => {
      document.getElementById(rootId)?.remove();

      const styleId = `${rootId}-style`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes flow-doc-caption-in {
            0% { opacity: 0; transform: translateY(14px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `;
        document.head.append(style);
      }

      const root = document.createElement('div');
      root.id = rootId;
      root.style.cssText = [
        'position: fixed',
        'left: 24px',
        'right: 24px',
        'bottom: 24px',
        'z-index: 2147483647',
        'pointer-events: none',
        'font-family: system-ui, -apple-system, sans-serif',
      ].join(';');

      const card = document.createElement('div');
      card.style.cssText = [
        'background: rgba(16, 16, 20, 0.92)',
        'color: #fff',
        'border-left: 4px solid #e30613',
        'border-radius: 10px',
        'padding: 16px 20px',
        'box-shadow: 0 12px 40px rgba(0,0,0,0.35)',
        'max-width: 720px',
        'animation: flow-doc-caption-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
      ].join(';');

      const label = document.createElement('div');
      label.textContent = totalSteps ? `Step ${stepNumber} of ${totalSteps}` : `Step ${stepNumber}`;
      label.style.cssText = [
        'font-size: 12px',
        'font-weight: 700',
        'letter-spacing: 0.08em',
        'text-transform: uppercase',
        'color: #f5b4b8',
        'margin-bottom: 6px',
      ].join(';');

      const heading = document.createElement('div');
      heading.textContent = title;
      heading.style.cssText = 'font-size: 20px; font-weight: 700; margin-bottom: 8px; line-height: 1.3;';

      const copy = document.createElement('div');
      copy.textContent = body;
      copy.style.cssText = 'font-size: 15px; line-height: 1.5; color: rgba(255,255,255,0.92);';

      card.append(label, heading, copy);
      root.append(card);
      document.body.append(root);
    },
    { rootId: CAPTION_ROOT_ID, stepNumber, totalSteps, title, body },
  );
}

export async function hideStepCaption(page: Page) {
  await page.evaluate((rootId) => {
    document.getElementById(rootId)?.remove();
  }, CAPTION_ROOT_ID);
}

export async function pauseForVideo(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}
