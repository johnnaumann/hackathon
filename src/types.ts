export type LocatorSpec =
  | { role: string; name: string; exact?: boolean; within?: LocatorSpec }
  | { text: string; exact?: boolean; within?: LocatorSpec }
  | { css: string; within?: LocatorSpec };

export type FlowStep = {
  id: string;
  action: 'goto' | 'click' | 'click_optional' | 'scroll_to' | 'assert_visible';
  url?: string;
  locator?: LocatorSpec;
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
    captions: string;
  };
};
