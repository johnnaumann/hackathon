/** Standard 16:9 viewport — matches what a user sees in the browser content area. */
export const VIEWPORT = { width: 1920, height: 1080 } as const;

/** Pause after the caption appears so the viewer can read it before the action. */
export const CAPTION_READ_MS = 1_000;
/** Show the target highlight briefly before narration. */
export const HIGHLIGHT_BEAT_MS = 350;
export const POST_STEP_HOLD_MS = 700;

/** Base duration for eased scroll animations during video recording. */
export const VIDEO_SCROLL_DURATION_MS = 3_000;
