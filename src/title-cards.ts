import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { VIEWPORT } from './constants.js';
import type { FlowDefinition } from './types.js';

export const DEFAULT_INTRO_DURATION_MS = 4_000;
export const DEFAULT_END_CARD_DURATION_MS = 3_200;

export type IntroCardConfig = {
  duration_ms: number;
  title: string;
  subtitle: string;
  site: string;
};

export type EndCardConfig = {
  duration_ms: number;
  image?: string;
  heading: string;
  text: string;
};

function siteLabel(site: string): string {
  try {
    return new URL(site).host;
  } catch {
    return site;
  }
}

export function resolveIntroCard(flow: FlowDefinition): IntroCardConfig | null {
  const config = flow.video?.intro_card;
  if (config === false) return null;
  const overrides = typeof config === 'object' ? config : {};
  return {
    duration_ms: overrides.duration_ms ?? DEFAULT_INTRO_DURATION_MS,
    title: overrides.title ?? flow.title,
    subtitle: overrides.subtitle ?? flow.description.trim(),
    site: siteLabel(flow.site),
  };
}

export function resolveEndCard(flow: FlowDefinition): EndCardConfig | null {
  const config = flow.video?.end_card;
  if (!config) return null;
  const overrides = typeof config === 'object' ? config : {};
  return {
    duration_ms: overrides.duration_ms ?? DEFAULT_END_CARD_DURATION_MS,
    image: overrides.image,
    heading: overrides.heading ?? 'Thanks for watching',
    text: overrides.text ?? siteLabel(flow.site),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function introCardHtml(card: IntroCardConfig): string {
  return `
  <body style="margin:0;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;overflow:hidden;
               font-family:system-ui,-apple-system,sans-serif;
               background:#101014;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;inset:0;
                background:
                  radial-gradient(900px 540px at 18% 22%, rgba(227,6,19,0.28), transparent 65%),
                  radial-gradient(1100px 700px at 85% 85%, rgba(227,6,19,0.16), transparent 70%);"></div>
    <div style="position:relative;max-width:1240px;padding:0 120px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
        <div style="width:46px;height:5px;background:#e30613;border-radius:3px;"></div>
        <div style="font-size:21px;font-weight:700;letter-spacing:0.22em;color:#f5b4b8;text-transform:uppercase;">
          Step-by-step guide
        </div>
      </div>
      <div style="font-size:74px;font-weight:800;line-height:1.12;color:#ffffff;letter-spacing:-0.01em;">
        ${escapeHtml(card.title)}
      </div>
      <div style="margin-top:30px;font-size:29px;line-height:1.5;color:rgba(255,255,255,0.82);max-width:980px;">
        ${escapeHtml(card.subtitle)}
      </div>
      <div style="margin-top:54px;display:inline-flex;align-items:center;gap:12px;
                  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);
                  border-radius:999px;padding:14px 30px;font-size:24px;font-weight:600;color:#ffffff;">
        <span style="width:10px;height:10px;border-radius:50%;background:#e30613;"></span>
        ${escapeHtml(card.site)}
      </div>
    </div>
  </body>`;
}

async function endCardHtml(card: EndCardConfig): Promise<string> {
  let imageTag = '';
  if (card.image) {
    const buffer = await readFile(path.resolve(card.image));
    const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
    imageTag = `<img src="${dataUri}" style="height:620px;object-fit:contain;" alt="" />`;
  }

  return `
  <body style="margin:0;width:${VIEWPORT.width}px;height:${VIEWPORT.height}px;overflow:hidden;
               font-family:system-ui,-apple-system,sans-serif;background:#ffffff;
               display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;">
    ${imageTag}
    <div style="text-align:center;">
      <div style="font-size:46px;font-weight:800;color:#1a1a1e;">${escapeHtml(card.heading)}</div>
      <div style="margin-top:16px;display:inline-flex;align-items:center;gap:12px;font-size:26px;
                  font-weight:600;color:#e30613;">
        <span style="width:30px;height:4px;background:#e30613;border-radius:2px;"></span>
        ${escapeHtml(card.text)}
        <span style="width:30px;height:4px;background:#e30613;border-radius:2px;"></span>
      </div>
    </div>
  </body>`;
}

/**
 * Screenshot the intro/end cards as full-frame PNGs (browser-rendered so we get
 * proper fonts and layout without depending on ffmpeg drawtext fonts).
 */
export async function renderCardImages(
  flow: FlowDefinition,
  workDir: string,
): Promise<{ introPng?: string; endPng?: string; intro?: IntroCardConfig; end?: EndCardConfig }> {
  const intro = resolveIntroCard(flow);
  const end = resolveEndCard(flow);
  if (!intro && !end) return {};

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  const result: { introPng?: string; endPng?: string; intro?: IntroCardConfig; end?: EndCardConfig } = {};

  try {
    if (intro) {
      await page.setContent(introCardHtml(intro), { waitUntil: 'load' });
      const introPng = path.join(workDir, 'intro-card.png');
      await page.screenshot({ path: introPng });
      result.introPng = introPng;
      result.intro = intro;
    }
    if (end) {
      await page.setContent(await endCardHtml(end), { waitUntil: 'load' });
      const endPng = path.join(workDir, 'end-card.png');
      await page.screenshot({ path: endPng });
      result.endPng = endPng;
      result.end = end;
    }
  } finally {
    await browser.close();
  }

  return result;
}
