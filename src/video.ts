import { access, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FlowDefinition, FlowResult } from './types.js';

const execFileAsync = promisify(execFile);
const DEFAULT_MUSIC = path.resolve('assets/music/background.mp3');
const DEFAULT_MUSIC_VOLUME = 0.45;

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

async function getMediaDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

function resolveMusicPath(flow: FlowDefinition): string {
  const configured = flow.video?.music;
  return path.resolve(configured ?? DEFAULT_MUSIC);
}

async function trimVideo(rawVideoPath: string, webmPath: string, trimStartMs: number): Promise<void> {
  if (trimStartMs > 100) {
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
    return;
  }

  await copyFile(rawVideoPath, webmPath);
  console.log(`Video saved → ${webmPath}`);
}

async function muxBackgroundMusic(
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
    ...(isWebm ? ['-b:v', '2M'] : ['-preset', 'fast', '-crf', '23']),
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

/** Save viewport recording, optional background music, and SRT timing file. */
export async function finalizeVideo(
  result: FlowResult,
  rawVideoPath: string,
  trimStartMs = 0,
): Promise<void> {
  const resolvedOutputDir = path.resolve(result.flow.output_dir);
  const silentWebmPath = path.join(resolvedOutputDir, 'flow-silent.webm');
  const webmPath = path.join(resolvedOutputDir, 'flow.webm');
  const mp4Path = path.join(resolvedOutputDir, 'flow.mp4');
  const srtPath = path.join(resolvedOutputDir, 'captions.srt');

  if (!(await ffmpegAvailable())) {
    await copyFile(rawVideoPath, webmPath);
    console.log(`Video saved → ${webmPath} (install ffmpeg for trim + music)`);
    await writeFile(srtPath, renderSrt(result), 'utf8');
    return;
  }

  await trimVideo(rawVideoPath, silentWebmPath, trimStartMs);

  const musicPath = resolveMusicPath(result.flow);
  const musicVolume = result.flow.video?.music_volume ?? DEFAULT_MUSIC_VOLUME;
  const hasMusic = await fileExists(musicPath);

  if (hasMusic) {
    await muxBackgroundMusic(silentWebmPath, musicPath, webmPath, musicVolume);
    await muxBackgroundMusic(silentWebmPath, musicPath, mp4Path, musicVolume);
    console.log(`Video with music saved → ${webmPath}`);
    console.log(`Video with music saved → ${mp4Path}`);
    result.video = {
      webm: 'flow.webm',
      mp4: 'flow.mp4',
      captions: 'captions.srt',
    };
  } else {
    await copyFile(silentWebmPath, webmPath);
    console.log(`Video saved → ${webmPath}`);
    console.log('Background music not found — skipping audio mux');
    result.video = {
      webm: 'flow.webm',
      captions: 'captions.srt',
    };
  }

  await writeFile(srtPath, renderSrt(result), 'utf8');
  console.log(`Caption timing saved → ${srtPath} (for future voiceover)`);
}
