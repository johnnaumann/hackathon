import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FlowResult } from './types.js';

function msToSrtTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}

export function renderSrt(result: FlowResult): string {
  const cues = result.steps
    .filter((step) => step.video_start_ms !== undefined && step.video_end_ms !== undefined)
    .map((step, index) => {
      const start = msToSrtTimestamp(step.video_start_ms!);
      const end = msToSrtTimestamp(step.video_end_ms!);
      const text = `${step.title}\n${stripMarkdown(step.description)}`;
      return `${index + 1}\n${start} --> ${end}\n${text}\n`;
    });

  return `${cues.join('\n')}\n`;
}

/** Save viewport recording and SRT timing file (for future voiceover — not burned into video). */
export async function finalizeVideo(result: FlowResult, rawVideoPath: string): Promise<void> {
  const resolvedOutputDir = path.resolve(result.flow.output_dir);
  const webmPath = path.join(resolvedOutputDir, 'flow.webm');
  const srtPath = path.join(resolvedOutputDir, 'captions.srt');

  await copyFile(rawVideoPath, webmPath);
  await writeFile(srtPath, renderSrt(result), 'utf8');

  console.log(`Video saved → ${webmPath}`);
  console.log(`Caption timing saved → ${srtPath} (for future voiceover)`);
}
