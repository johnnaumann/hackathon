import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { parse as parseYaml } from 'yaml';
import { enableBrowserChrome, updateBrowserChromeUrl } from './browser-chrome.js';
import { hideStepCaption, pauseForVideo, showStepCaption } from './caption.js';
import { CAPTION_HOLD_MS, POST_STEP_HOLD_MS, VIDEO_SCROLL_DURATION_MS, VIEWPORT } from './constants.js';
import {
  clearHighlights,
  DEFAULT_HIGHLIGHT_COLOR,
  emphasizeClickTarget,
  injectHighlightStyles,
  markClickTarget,
} from './highlight.js';
import { resolveLocator } from './locators.js';
import {
  clearCmpOverlay,
  ensureAtTop,
  ensureFormInView,
  waitAndDismissCookieBanner,
  waitForPageReady,
} from './overlays.js';
import {
  measureScrollDistance,
  scrollDurationForDistance,
  smoothScrollToLocator,
} from './smooth-scroll.js';
import type { FlowDefinition, FlowResult, FlowStep, RecordedStep } from './types.js';
import { finalizeVideo } from './video.js';
import { generateVoiceoverForFlow } from './voiceover.js';

const FLOWS_DIR = path.resolve('flows');
const DEFAULT_FLOW = 'contact-from-home.yaml';

type RunMode = 'video' | 'screenshots';

type RunStepOptions = {
  mode: RunMode;
  outputDir: string;
  stepNumber: number;
  videoClock?: { startedAt: number };
  scrollDurationMs: number;
};

async function scrollForRecording(
  page: Page,
  locator: import('@playwright/test').Locator,
  isVideo: boolean,
  scrollDurationMs: number,
  step?: FlowStep,
) {
  if (!isVideo) {
    await locator.scrollIntoViewIfNeeded();
    return;
  }

  const baseMs = step?.scroll_duration_ms ?? scrollDurationMs;
  const distance = await measureScrollDistance(page, locator);
  const durationMs = scrollDurationForDistance(distance, baseMs);
  await smoothScrollToLocator(page, locator, durationMs);
}

async function loadFlow(flowFile = DEFAULT_FLOW): Promise<FlowDefinition> {
  const filePath = path.join(FLOWS_DIR, flowFile);
  const yamlContent = await readFile(filePath, 'utf8');
  return parseYaml(yamlContent) as FlowDefinition;
}

function shouldShowVideoCaption(step: FlowStep): boolean {
  if (step.video_caption !== undefined) return step.video_caption;
  return step.screenshot !== 'none';
}

const HIGHLIGHT_ACTIONS = new Set(['click', 'fill', 'scroll_to', 'assert_visible']);

async function showVideoStepCaption(
  page: Page,
  stepNumber: number,
  step: FlowStep,
  videoClock: { startedAt: number },
  recorded: RecordedStep,
) {
  recorded.video_start_ms = Date.now() - videoClock.startedAt;
  await showStepCaption(page, stepNumber, step.title, step.description);
  await pauseForVideo(page, CAPTION_HOLD_MS);
}

async function captureStepScreenshot(
  page: Page,
  outputDir: string,
  step: FlowStep,
): Promise<string | undefined> {
  if (!step.screenshot || step.screenshot === 'none') {
    return undefined;
  }

  const fileName = `${step.id}.png`;
  const filePath = path.join(outputDir, 'assets', fileName);

  await page.screenshot({
    path: filePath,
    fullPage: step.screenshot === 'fullPage',
  });

  return `assets/${fileName}`;
}

async function runStep(page: Page, step: FlowStep, options: RunStepOptions): Promise<RecordedStep> {
  const { mode, outputDir, stepNumber, videoClock, scrollDurationMs } = options;
  const isVideo = mode === 'video';

  await clearHighlights(page);

  const recorded: RecordedStep = {
    id: step.id,
    title: step.title,
    description: step.description.trim(),
    url: page.url(),
  };

  const showCaption = isVideo && shouldShowVideoCaption(step);
  const deferCaption = showCaption && step.action === 'goto';
  const deferCaptionForHighlight =
    showCaption && step.highlight === true && HIGHLIGHT_ACTIONS.has(step.action);

  if (showCaption && !deferCaption && !deferCaptionForHighlight && videoClock) {
    await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
  }

  switch (step.action) {
    case 'goto': {
      const targetUrl = step.url!;
      const onPage =
        page.url() === targetUrl ||
        page.url().replace(/\/$/, '') === targetUrl.replace(/\/$/, '');

      if (!onPage) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await waitAndDismissCookieBanner(page);
      }
      await ensureAtTop(page);
      if (step.wait_for) {
        await resolveLocator(page, step.wait_for).waitFor({ state: 'visible', timeout: 15_000 });
      } else if (isVideo) {
        await waitForPageReady(page);
      }
      await ensureAtTop(page);
      if (isVideo) {
        await updateBrowserChromeUrl(page);
        await pauseForVideo(page, 400);
      }
      if (deferCaption && videoClock) {
        if (step.wait_for && isVideo) {
          await markClickTarget(page, resolveLocator(page, step.wait_for));
          await pauseForVideo(page, 400);
        }
        await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
      }
      break;
    }

    case 'click_optional': {
      if (step.locator) {
        const locator = resolveLocator(page, step.locator);
        if ((await locator.count()) > 0) {
          await locator.first().click({ timeout: 5000 });
          if (isVideo) {
            await updateBrowserChromeUrl(page);
            await pauseForVideo(page, 500);
          }
        }
      }
      break;
    }

    case 'click': {
      if (!step.locator) throw new Error(`Step ${step.id} requires a locator`);
      const locator = resolveLocator(page, step.locator);
      if (step.scroll_before === false && isVideo) {
        await ensureFormInView(page);
      } else {
        await clearCmpOverlay(page);
      }
      if (step.scroll_before !== false) {
        await scrollForRecording(page, locator, isVideo, scrollDurationMs, step);
      } else if (!isVideo) {
        await locator.scrollIntoViewIfNeeded();
      }
      if (step.highlight) {
        await markClickTarget(page, locator);
        if (isVideo) await pauseForVideo(page, 350);
      }
      if (showCaption && deferCaptionForHighlight && videoClock) {
        await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
      }
      if (!isVideo) {
        await clearCmpOverlay(page);
        recorded.screenshot = await captureStepScreenshot(page, outputDir, step);
      }
      if (isVideo && step.highlight) {
        await emphasizeClickTarget(page, locator);
      }
      await locator.click({ force: step.click_force ?? false });
      await page.waitForLoadState('domcontentloaded');
      if (step.wait_for_url) {
        await page.waitForURL(step.wait_for_url, { timeout: 15_000 });
      }
      if (isVideo && step.wait_after_ms) {
        await pauseForVideo(page, step.wait_after_ms);
      }
      if (isVideo) {
        await updateBrowserChromeUrl(page);
        await pauseForVideo(page, POST_STEP_HOLD_MS);
      }
      recorded.url = page.url();
      if (showCaption && videoClock) {
        recorded.video_end_ms = Date.now() - videoClock.startedAt;
        await hideStepCaption(page);
      }
      return recorded;
    }

    case 'scroll_to': {
      if (!step.locator) throw new Error(`Step ${step.id} requires a locator`);
      const locator = resolveLocator(page, step.locator);
      await scrollForRecording(page, locator, isVideo, scrollDurationMs, step);
      if (step.highlight) {
        await markClickTarget(page, locator);
        if (isVideo) await pauseForVideo(page, 350);
      }
      if (showCaption && deferCaptionForHighlight && videoClock) {
        await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
      }
      if (isVideo) {
        await pauseForVideo(page, 500);
      }
      break;
    }

    case 'assert_visible': {
      if (!step.locator) throw new Error(`Step ${step.id} requires a locator`);
      const locator = resolveLocator(page, step.locator);
      await locator.waitFor({ state: 'visible', timeout: 15_000 });
      if (isVideo) await ensureFormInView(page);
      if (step.highlight) {
        await markClickTarget(page, locator);
        if (isVideo) await pauseForVideo(page, 350);
      }
      if (showCaption && deferCaptionForHighlight && videoClock) {
        await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
      }
      if (isVideo) {
        await pauseForVideo(page, POST_STEP_HOLD_MS);
      }
      break;
    }

    case 'fill': {
      if (!step.locator) throw new Error(`Step ${step.id} requires a locator`);
      if (step.value === undefined) throw new Error(`Step ${step.id} requires a value`);
      const locator = resolveLocator(page, step.locator);
      if (step.scroll_before !== false) {
        await scrollForRecording(page, locator, isVideo, scrollDurationMs, step);
      } else if (!isVideo) {
        await locator.scrollIntoViewIfNeeded();
      } else {
        await ensureFormInView(page);
      }
      if (step.highlight) {
        await markClickTarget(page, locator);
        if (isVideo) await pauseForVideo(page, 350);
      }
      if (showCaption && deferCaptionForHighlight && videoClock) {
        await showVideoStepCaption(page, stepNumber, step, videoClock, recorded);
      }
      if (isVideo && step.highlight) {
        await emphasizeClickTarget(page, locator);
      }
      await locator.evaluate((el) => {
        (el as HTMLElement).focus({ preventScroll: true });
      });
      await locator.fill('');
      const typeDelay = step.type_delay_ms ?? (isVideo ? 65 : 0);
      if (isVideo && typeDelay > 0) {
        await locator.pressSequentially(step.value, { delay: typeDelay });
      } else {
        await locator.fill(step.value);
      }
      if (isVideo) {
        await page.waitForTimeout(250);
        await ensureFormInView(page);
        await pauseForVideo(page, step.wait_after_ms ?? 800);
      }
      recorded.url = page.url();
      break;
    }

    default:
      throw new Error(`Unknown action: ${(step as FlowStep).action}`);
  }

  if (!isVideo) {
    recorded.screenshot = await captureStepScreenshot(page, outputDir, step);
  }
  recorded.url = page.url();

  if (showCaption && videoClock) {
    recorded.video_end_ms = Date.now() - videoClock.startedAt;
    await hideStepCaption(page);
  }

  return recorded;
}

async function runVideoPass(flow: FlowDefinition, outputDir: string): Promise<{
  steps: RecordedStep[];
  rawVideoPath?: string;
  trimStartMs: number;
}> {
  const videoDir = path.join(outputDir, 'video-raw');
  await mkdir(videoDir, { recursive: true });

  const showActions = flow.video?.show_actions ?? false;
  const highlightColor = flow.video?.highlight_color ?? DEFAULT_HIGHLIGHT_COLOR;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'en-GB',
    recordVideo: {
      dir: videoDir,
      size: VIEWPORT,
      ...(showActions
        ? {
            showActions:
              typeof showActions === 'object'
                ? showActions
                : { duration: 900, position: 'top-right' as const, fontSize: 22 },
          }
        : {}),
    },
  });
  const page = await context.newPage();
  const recordStartedAt = Date.now();
  await enableBrowserChrome(page);
  await injectHighlightStyles(page, highlightColor);

  const firstGoto = flow.steps.find((step) => step.action === 'goto' && step.url);
  if (firstGoto?.url) {
    await page.goto(firstGoto.url, { waitUntil: 'domcontentloaded' });
    await waitAndDismissCookieBanner(page);
    await waitForPageReady(page);
    await ensureAtTop(page);
  }

  const trimStartMs = Date.now() - recordStartedAt;
  await ensureAtTop(page);
  const videoClock = { startedAt: Date.now() };
  const scrollDurationMs = flow.video?.scroll_duration_ms ?? VIDEO_SCROLL_DURATION_MS;
  const recordedSteps: RecordedStep[] = [];
  let rawVideoPath: string | undefined;

  try {
    let visibleStepNumber = 0;
    for (const step of flow.steps) {
      if (shouldShowVideoCaption(step)) {
        visibleStepNumber += 1;
      }
      console.log(`→ [video] ${step.id}: ${step.title}`);
      const recorded = await runStep(page, step, {
        mode: 'video',
        outputDir,
        stepNumber: visibleStepNumber || recordedSteps.length + 1,
        videoClock,
        scrollDurationMs,
      });
      recordedSteps.push(recorded);
    }
  } finally {
    rawVideoPath = await page.video()?.path();
    await context.close();
    await browser.close();
  }

  return { steps: recordedSteps, rawVideoPath, trimStartMs };
}

async function runScreenshotPass(
  flow: FlowDefinition,
  outputDir: string,
): Promise<Map<string, string | undefined>> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'en-GB',
  });
  const page = await context.newPage();
  const highlightColor = flow.video?.highlight_color ?? DEFAULT_HIGHLIGHT_COLOR;
  await injectHighlightStyles(page, highlightColor);

  const firstGoto = flow.steps.find((step) => step.action === 'goto' && step.url);
  if (firstGoto?.url) {
    await page.goto(firstGoto.url, { waitUntil: 'domcontentloaded' });
    await waitAndDismissCookieBanner(page);
    await waitForPageReady(page);
    await ensureAtTop(page);
  }

  const screenshots = new Map<string, string | undefined>();

  try {
    for (const step of flow.steps) {
      console.log(`→ [screenshots] ${step.id}`);
      const recorded = await runStep(page, step, {
        mode: 'screenshots',
        outputDir,
        stepNumber: 0,
        scrollDurationMs: VIDEO_SCROLL_DURATION_MS,
      });
      screenshots.set(step.id, recorded.screenshot);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return screenshots;
}

export async function recordFlow(flowFile = DEFAULT_FLOW): Promise<FlowResult> {
  const flow = await loadFlow(flowFile);
  const outputDir = path.resolve(flow.output_dir);
  await mkdir(path.join(outputDir, 'assets'), { recursive: true });

  const { steps: videoSteps, rawVideoPath, trimStartMs } = await runVideoPass(flow, outputDir);

  const result: FlowResult = {
    flow,
    recorded_at: new Date().toISOString(),
    steps: videoSteps,
  };

  if (rawVideoPath) {
    await finalizeVideo(result, rawVideoPath, trimStartMs);
    if (flow.video?.voiceover) {
      await generateVoiceoverForFlow(flow, outputDir);
    }
  }

  let screenshots = new Map<string, string | undefined>();
  try {
    screenshots = await runScreenshotPass(flow, outputDir);
  } catch (error) {
    console.warn('Screenshot pass failed — video output is still available:', error);
  }

  result.steps = videoSteps.map((step) => ({
    ...step,
    screenshot: screenshots.get(step.id),
  }));

  await writeFile(
    path.join(outputDir, 'flow-result.json'),
    JSON.stringify(result, null, 2),
    'utf8',
  );

  console.log(`\nRecorded ${result.steps.length} steps → ${outputDir}`);
  return result;
}

const flowArg = process.argv[2];
recordFlow(flowArg).catch((error) => {
  console.error(error);
  process.exit(1);
});
