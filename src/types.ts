export type LocatorSpec =
  | { role: string; name: string; exact?: boolean; within?: LocatorSpec }
  | { text: string; exact?: boolean; within?: LocatorSpec }
  | { css: string; within?: LocatorSpec };

export type FlowStep = {
  id: string;
  action: 'goto' | 'click' | 'click_optional' | 'scroll_to' | 'assert_visible' | 'fill';
  url?: string;
  locator?: LocatorSpec;
  /** Text to type for fill steps */
  value?: string;
  /** Per-keystroke delay during video recording (ms) — makes typing visible */
  type_delay_ms?: number;
  /** Wait for this element after navigation before showing the step caption */
  wait_for?: LocatorSpec;
  title: string;
  description: string;
  highlight?: boolean;
  screenshot?: 'fullPage' | 'viewport' | 'none';
  /** Show an on-screen caption card in the recorded video (default: true unless screenshot is none) */
  video_caption?: boolean;
  /** Override eased scroll duration for this step during video recording (ms) */
  scroll_duration_ms?: number;
  /** Smooth-scroll before click during video recording (default: true) */
  scroll_before?: boolean;
  /** Force click (for animated overlays like navigation menus) */
  click_force?: boolean;
  /** Pause after click during video recording (ms) */
  wait_after_ms?: number;
  /** Wait for URL pattern after click (string or regex source) */
  wait_for_url?: string;
};

export type FlowDefinition = {
  name: string;
  title: string;
  description: string;
  site: string;
  output_dir: string;
  steps: FlowStep[];
  video?: {
    /** Default eased scroll duration during video recording (ms) */
    scroll_duration_ms?: number;
    /** Path to background music track (relative to repo root) */
    music?: string;
    /** Background music volume 0–1 (default 0.45) */
    music_volume?: number;
    /** Background music volume when voiceover is mixed (default: music_volume × 0.4) */
    music_volume_with_voice?: number;
    /** Edge TTS voice name (default: en-GB-SoniaNeural) */
    voice?: string;
    /** Generate AI voiceover from captions.srt after recording */
    voiceover?: boolean;
  };
};

export type RecordedStep = {
  id: string;
  title: string;
  description: string;
  screenshot?: string;
  url: string;
  video_start_ms?: number;
  video_end_ms?: number;
};

export type FlowResult = {
  flow: FlowDefinition;
  recorded_at: string;
  steps: RecordedStep[];
  video?: {
    webm: string;
    mp4?: string;
    captions: string;
  };
};
