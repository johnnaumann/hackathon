export type LocatorSpec =
  | { role: string; name: string; exact?: boolean }
  | { text: string; exact?: boolean }
  | { css: string };

export type FlowStep = {
  id: string;
  action: 'goto' | 'click' | 'click_optional' | 'scroll_to' | 'assert_visible';
  url?: string;
  locator?: LocatorSpec;
  title: string;
  description: string;
  highlight?: boolean;
  screenshot?: 'fullPage' | 'viewport' | 'none';
  /** Show an on-screen caption card in the recorded video (default: true unless screenshot is none) */
  video_caption?: boolean;
};

export type FlowDefinition = {
  name: string;
  title: string;
  description: string;
  site: string;
  output_dir: string;
  steps: FlowStep[];
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
