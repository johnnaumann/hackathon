import { access, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderCardImages } from './title-cards.js';
import type { FlowDefinition, FlowResult } from './types.js';

const execFileAsync = promisify(execFile);
const DEFAULT_MUSIC = path.resolve('assets/music/background.mp3');
const DEFAULT_MUSIC_VOLUME = 0.45;

const FPS = 25;
/** Encoder settings shared by every segment so concatenation stays seamless. */
const H264_ARGS = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p'];

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

export type IntroCue = {
  startMs: number;
  endMs: number;
  text: string;
};

export function renderSrt(result: FlowResult, introCue?: IntroCue): string {
  const cues: string[] = [];

  if (introCue) {
    cues.push(
      `${cues.length + 1}\n${msToSrtTimestamp(introCue.startMs)} --> ${msToSrtTimestamp(introCue.endMs)}\n${introCue.text}\n`,
    );
  }

  for (const step of result.steps) {
    if (step.video_start_ms === undefined || step.video_end_ms === undefined) continue;
    const start = msToSrtTimestamp(step.video_start_ms);
    const end = msToSrtTimestamp(step.video_end_ms);
    const text = `${step.title}\n${stripMarkdown(step.description)}`;
    cues.push(`${cues.length + 1}\n${start} --> ${end}\n${text}\n`);
  }

  return `${cues.join('\n')}\n`;
}

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const parsed = parseFloat(stdout.trim());
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  // Playwright's webm recordings sometimes lack duration metadata — decode to find out.
  const { stderr } = await execFileAsync('ffmpeg', ['-i', filePath, '-f', 'null', '-']);
  const matches = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = matches[matches.length - 1];
  if (!last) throw new Error(`Could not determine duration of ${filePath}`);
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

function resolveMusicPath(flow: FlowDefinition): string {
  const configured = flow.video?.music;
  return path.resolve(configured ?? DEFAULT_MUSIC);
}

type AssembleOptions = {
  rawVideoPath: string;
  trimStartMs: number;
  introPng?: string;
  introDurationSec?: number;
  endPng?: string;
  endDurationSec?: number;
  outputPath: string;
};

/**
 * Frame-accurate trim of the raw recording (re-encoded — stream copy can only
 * cut on keyframes, which used to leak the cookie banner into the opening
 * frames), plus optional intro/end cards, assembled in a single encode.
 */
async function assembleSilentVideo(options: AssembleOptions): Promise<void> {
  const { rawVideoPath, trimStartMs, introPng, introDurationSec, endPng, endDurationSec, outputPath } =
    options;

  const rawDurationSec = await getMediaDurationSeconds(rawVideoPath);
  const trimSec = trimStartMs > 100 ? trimStartMs / 1000 : 0;
  const contentDurationSec = Math.max(0.5, rawDurationSec - trimSec);

  const inputs: string[] = [];
  const filters: string[] = [];
  const concatLabels: string[] = [];
  let inputIndex = 0;

  const base = `fps=${FPS},scale=1920:1080,setsar=1,format=yuv420p`;

  if (introPng && introDurationSec) {
    inputs.push('-loop', '1', '-t', introDurationSec.toFixed(2), '-i', introPng);
    const fadeOut = Math.max(0, introDurationSec - 0.5).toFixed(2);
    filters.push(
      `[${inputIndex}:v]${base},fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOut}:d=0.5[intro]`,
    );
    concatLabels.push('[intro]');
    inputIndex += 1;
  }

  if (trimSec > 0) {
    inputs.push('-ss', trimSec.toFixed(3), '-i', rawVideoPath);
  } else {
    inputs.push('-i', rawVideoPath);
  }
  const contentFadeOut = Math.max(0, contentDurationSec - 0.45).toFixed(2);
  filters.push(
    `[${inputIndex}:v]${base},fade=t=in:st=0:d=0.3,fade=t=out:st=${contentFadeOut}:d=0.45[content]`,
  );
  concatLabels.push('[content]');
  inputIndex += 1;

  if (endPng && endDurationSec) {
    inputs.push('-loop', '1', '-t', endDurationSec.toFixed(2), '-i', endPng);
    filters.push(`[${inputIndex}:v]${base},fade=t=in:st=0:d=0.5[end]`);
    concatLabels.push('[end]');
    inputIndex += 1;
  }

  const filterComplex = `${filters.join(';')};${concatLabels.join('')}concat=n=${concatLabels.length}:v=1:a=0[out]`;

  await execFileAsync('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out]',
    ...H264_ARGS,
    outputPath,
  ]);
}

export async function muxBackgroundMusic(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  volume: number,
): Promise<void> {
  const duration = await getMediaDurationSeconds(videoPath);
  const fadeOutStart = Math.max(0, duration - 2).toFixed(2);
  const durationLabel = duration.toFixed(2);
  const isWebm = outputPath.endsWith('.webm');

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-stream_loop',
    '-1',
    '-i',
    musicPath,
    '-filter_complex',
    `[1:a]volume=${volume},afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2,atrim=0:${durationLabel}[music]`,
    '-map',
    '0:v:0',
    '-map',
    '[music]',
    '-c:v',
    isWebm ? 'libvpx-vp9' : 'libx264',
    ...(isWebm
      ? ['-b:v', '2M', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p']
      : ['-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']),
    '-c:a',
    isWebm ? 'libopus' : 'aac',
    '-b:a',
    '160k',
    '-shortest',
    outputPath,
  ]);
}

function trimMsLabel(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Build the final silent master (trim + intro/end cards), shift step timings to
 * the final video timeline, then write captions and music-only outputs.
 * Voiceover (if enabled) re-muxes from the same silent master afterwards.
 */
export async function finalizeVideo(
  result: FlowResult,
  rawVideoPath: string,
  trimStartMs = 0,
): Promise<void> {
  const resolvedOutputDir = path.resolve(result.flow.output_dir);
  const silentPath = path.join(resolvedOutputDir, 'flow-silent.mp4');
  const webmPath = path.join(resolvedOutputDir, 'flow.webm');
  const mp4Path = path.join(resolvedOutputDir, 'flow.mp4');
  const srtPath = path.join(resolvedOutputDir, 'captions.srt');

  if (!(await ffmpegAvailable())) {
    await copyFile(rawVideoPath, webmPath);
    console.log(`Video saved → ${webmPath} (install ffmpeg for trim, cards and music)`);
    await writeFile(srtPath, renderSrt(result), 'utf8');
    return;
  }

  const workDir = path.dirname(rawVideoPath);
  const cards = await renderCardImages(result.flow, workDir);
  const introDurationMs = cards.intro?.duration_ms ?? 0;

  await assembleSilentVideo({
    rawVideoPath,
    trimStartMs,
    introPng: cards.introPng,
    introDurationSec: cards.intro ? cards.intro.duration_ms / 1000 : undefined,
    endPng: cards.endPng,
    endDurationSec: cards.end ? cards.end.duration_ms / 1000 : undefined,
    outputPath: silentPath,
  });
  const trimNote = trimStartMs > 100 ? `, trimmed ${trimMsLabel(trimStartMs)} pre-roll` : '';
  const cardsNote = [cards.intro && 'intro card', cards.end && 'end card'].filter(Boolean).join(' + ');
  console.log(`Silent master saved → ${silentPath} (${cardsNote || 'no cards'}${trimNote})`);

  if (introDurationMs > 0) {
    for (const step of result.steps) {
      if (step.video_start_ms !== undefined) step.video_start_ms += introDurationMs;
      if (step.video_action_ms !== undefined) step.video_action_ms += introDurationMs;
      if (step.video_end_ms !== undefined) step.video_end_ms += introDurationMs;
    }
  }

  const introCue: IntroCue | undefined = cards.intro
    ? { startMs: 450, endMs: introDurationMs, text: cards.intro.title }
    : undefined;
  await writeFile(srtPath, renderSrt(result, introCue), 'utf8');
  console.log(`Caption timing saved → ${srtPath}`);

  const musicPath = resolveMusicPath(result.flow);
  const musicVolume = result.flow.video?.music_volume ?? DEFAULT_MUSIC_VOLUME;
  const hasMusic = await fileExists(musicPath);

  if (hasMusic) {
    await muxBackgroundMusic(silentPath, musicPath, webmPath, musicVolume);
    await muxBackgroundMusic(silentPath, musicPath, mp4Path, musicVolume);
    console.log(`Video with music saved → ${webmPath}`);
    console.log(`Video with music saved → ${mp4Path}`);
    result.video = {
      webm: 'flow.webm',
      mp4: 'flow.mp4',
      captions: 'captions.srt',
    };
  } else {
    await execFileAsync('ffmpeg', ['-y', '-i', silentPath, '-c:v', 'libvpx-vp9', '-b:v', '2M', '-cpu-used', '4', '-row-mt', '1', webmPath]);
    console.log(`Video saved → ${webmPath}`);
    console.log('Background music not found — skipping audio mux');
    result.video = {
      webm: 'flow.webm',
      captions: 'captions.srt',
    };
  }
}
