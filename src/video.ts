import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FlowResult } from './types.js';

const execFileAsync = promisify(execFile);

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
export async function finalizeVideo(
  result: FlowResult,
  rawVideoPath: string,
  trimStartMs = 0,
): Promise<void> {
  const resolvedOutputDir = path.resolve(result.flow.output_dir);
  const webmPath = path.join(resolvedOutputDir, 'flow.webm');
  const srtPath = path.join(resolvedOutputDir, 'captions.srt');

  if (trimStartMs > 100 && (await ffmpegAvailable())) {
    const trimSec = (trimStartMs / 1000).toFixed(3);
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      trimSec,
      '-i',
      rawVideoPath,
      '-c',
      'copy',
      webmPath,
    ]);
    console.log(`Video saved → ${webmPath} (trimmed ${trimMsLabel(trimStartMs)} pre-roll)`);
  } else {
    await copyFile(rawVideoPath, webmPath);
    console.log(`Video saved → ${webmPath}`);
  }

  await writeFile(srtPath, renderSrt(result), 'utf8');
  console.log(`Caption timing saved → ${srtPath} (for future voiceover)`);
}

function trimMsLabel(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}
