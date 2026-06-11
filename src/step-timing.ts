import type { Page } from '@playwright/test';
import { hideStepCaption, pauseForVideo, showStepCaption } from './caption.js';
import {
  ACTION_BEAT_MS,
  CAPTION_READ_MS,
  HIGHLIGHT_BEAT_MS,
  POST_ACTION_HOLD_MS,
  POST_STEP_HOLD_MS,
} from './constants.js';
import type { FlowStep, RecordedStep } from './types.js';

export type NarrationContext = {
  page: Page;
  stepNumber: number;
  step: FlowStep;
  videoClock: { startedAt: number };
  recorded: RecordedStep;
};

function nowMs(ctx: NarrationContext): number {
  return Date.now() - ctx.videoClock.startedAt;
}

/** Show the on-screen label and open the voiceover slot. */
export async function showStepLabel(ctx: NarrationContext) {
  ctx.recorded.video_start_ms = nowMs(ctx);
  await showStepCaption(ctx.page, ctx.stepNumber, ctx.step.title, ctx.step.description);
}

/** Let the viewer read/hear the title before the action. */
export async function pauseBeforeAction(page: Page, ms = CAPTION_READ_MS) {
  await pauseForVideo(page, ms);
}

export async function markActionMoment(ctx: NarrationContext) {
  ctx.recorded.video_action_ms = nowMs(ctx);
}

export async function highlightBeat(page: Page) {
  await pauseForVideo(page, HIGHLIGHT_BEAT_MS);
}

export async function actionBeat(page: Page) {
  await pauseForVideo(page, ACTION_BEAT_MS);
}

export async function holdAfterAction(page: Page) {
  await pauseForVideo(page, POST_ACTION_HOLD_MS);
}

export async function finishStep(ctx: NarrationContext, page: Page) {
  await pauseForVideo(page, POST_STEP_HOLD_MS);
  ctx.recorded.video_end_ms = nowMs(ctx);
  await hideStepCaption(ctx.page);
}
