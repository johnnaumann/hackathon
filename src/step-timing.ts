import type { Page } from '@playwright/test';
import { hideStepCaption, pauseForVideo, showStepCaption } from './caption.js';
import { CAPTION_READ_MS, HIGHLIGHT_BEAT_MS, POST_STEP_HOLD_MS } from './constants.js';
import type { FlowStep, RecordedStep } from './types.js';

export type NarrationContext = {
  page: Page;
  stepNumber: number;
  step: FlowStep;
  videoClock: { startedAt: number };
  recorded: RecordedStep;
};

/** Show the on-screen label and start the voiceover slot. */
export async function beginNarration(ctx: NarrationContext) {
  ctx.recorded.video_start_ms = Date.now() - ctx.videoClock.startedAt;
  await showStepCaption(ctx.page, ctx.stepNumber, ctx.step.title, ctx.step.description);
  await pauseForVideo(ctx.page, CAPTION_READ_MS);
}

export async function endNarration(ctx: NarrationContext) {
  ctx.recorded.video_end_ms = Date.now() - ctx.videoClock.startedAt;
  await hideStepCaption(ctx.page);
}

export async function holdAfterStep(page: Page) {
  await pauseForVideo(page, POST_STEP_HOLD_MS);
}

/** Brief pause so the highlight is visible before narration begins. */
export async function highlightBeat(page: Page) {
  await pauseForVideo(page, HIGHLIGHT_BEAT_MS);
}
