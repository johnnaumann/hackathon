import type { Page } from '@playwright/test';

const CHROME_HEIGHT = 40;
const CHROME_ROOT_ID = 'flow-doc-browser-chrome';

export async function enableBrowserChrome(page: Page) {
  await page.addInitScript(({ chromeHeight, rootId }) => {
    const mount = () => {
      if (document.getElementById(rootId)) return;

      const style = document.createElement('style');
      style.textContent = `
        #${rootId} {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: ${chromeHeight}px;
          z-index: 2147483646;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          background: linear-gradient(180deg, #ececec 0%, #dedede 100%);
          border-bottom: 1px solid #bdbdbd;
          font-family: system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
        }
        #${rootId} .lights {
          display: flex;
          gap: 7px;
          flex-shrink: 0;
        }
        #${rootId} .light {
          width: 11px;
          height: 11px;
          border-radius: 50%;
        }
        #${rootId} .light.red { background: #ff5f57; border: 1px solid #e0443e; }
        #${rootId} .light.yellow { background: #febc2e; border: 1px solid #dea123; }
        #${rootId} .light.green { background: #28c840; border: 1px solid #1aab29; }
        #${rootId} .toolbar {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        #${rootId} .nav-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: #f4f4f4;
          border: 1px solid #c8c8c8;
          color: #666;
          font-size: 14px;
          line-height: 22px;
          text-align: center;
          flex-shrink: 0;
        }
        #${rootId} .url-bar {
          flex: 1;
          min-width: 0;
          height: 26px;
          border-radius: 6px;
          background: #fff;
          border: 1px solid #c8c8c8;
          padding: 0 10px;
          font-size: 12px;
          line-height: 26px;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `;
      document.head.append(style);

      const root = document.createElement('div');
      root.id = rootId;
      root.innerHTML = `
        <div class="lights">
          <div class="light red"></div>
          <div class="light yellow"></div>
          <div class="light green"></div>
        </div>
        <div class="toolbar">
          <div class="nav-btn">‹</div>
          <div class="nav-btn">›</div>
          <div class="url-bar" id="flow-doc-chrome-url"></div>
        </div>
      `;
      document.body.prepend(root);

      const urlEl = document.getElementById('flow-doc-chrome-url');
      if (urlEl) urlEl.textContent = window.location.href;
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
  }, { chromeHeight: CHROME_HEIGHT, rootId: CHROME_ROOT_ID });
}

export async function updateBrowserChromeUrl(page: Page) {
  await page.evaluate((rootId) => {
    const urlEl = document.getElementById('flow-doc-chrome-url');
    if (urlEl) urlEl.textContent = window.location.href;
  }, CHROME_ROOT_ID);
}
