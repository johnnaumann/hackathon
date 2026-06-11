/** Standard 16:9 viewport — matches what a user sees in the browser content area. */
export const VIEWPORT = { width: 1920, height: 1080 } as const;

/** Pause after the label appears — viewer hears the title, then the action fires. */
export const CAPTION_READ_MS = 750;
/** Show the target highlight before the label. */
export const HIGHLIGHT_BEAT_MS = 250;
/** Brief beat with highlight framed before click/fill. */
export const ACTION_BEAT_MS = 180;
/** Hold after the primary action completes. */
export const POST_ACTION_HOLD_MS = 450;
/** Final pause before the next step. */
export const POST_STEP_HOLD_MS = 400;
/** Hold on the first/intro step so the opening narration is not clipped. */
export const INTRO_NARRATION_HOLD_MS = 2_800;

/** Base duration for eased scroll animations during video recording. */
export const VIDEO_SCROLL_DURATION_MS = 3_000;
