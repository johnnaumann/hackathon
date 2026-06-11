import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EdgeTTS } from 'edge-tts-universal';
import { parseSrt, type SrtCue } from './srt.js';
import type { FlowDefinition } from './types.js';

const execFileAsync = promisify(execFile);

export const DEFAULT_VOICE = 'en-GB-SoniaNeural';
/** Delay voice slightly after the on-screen caption appears. */
const NARRATION_LEAD_MS = 200;

export async function listEnglishFemaleVoices(): Promise<string[]> {
  const { VoicesManager } = await import('edge-tts-universal');
  const manager = await VoicesManager.create();
  return manager
    .find({ Language: 'en', Gender: 'Female' })
    .map((voice) => voice.ShortName)
    .sort();
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

export async function synthesizeSpeech(
  text: string,
  voice: string,
  outputPath: string,
): Promise<void> {
  const tts = new EdgeTTS(text, voice, { rate: '+5%' });
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  await writeFile(outputPath, buffer);
}

function buildAtempoChain(speedup: number): string {
  const filters: string[] = [];
  let remaining = speedup;
  while (remaining > 1.01) {
    const step = Math.min(remaining, 2);
    filters.push(`atempo=${step.toFixed(4)}`);
    remaining /= step;
  }
  return filters.join(',');
}

/** Speed up if needed, then hard-trim so narration never bleeds into the next cue. */
async function fitAudioToSlot(
  inputPath: string,
  outputPath: string,
  slotSec: number,
): Promise<void> {
  const duration = await getMediaDurationSeconds(inputPath);
  const targetSec = Math.max(slotSec * 0.85, 0.45);

  if (duration <= targetSec * 1.02) {
    if (Math.abs(duration - targetSec) < 0.05) {
      await copyFile(inputPath, outputPath);
      return;
    }
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-filter:a',
      `atrim=0:${targetSec.toFixed(3)},asetpts=PTS-STARTPTS`,
      outputPath,
    ]);
    return;
  }

  const speedup = duration / targetSec;
  const tempoChain = buildAtempoChain(speedup);
  const filter = tempoChain
    ? `${tempoChain},atrim=0:${targetSec.toFixed(3)},asetpts=PTS-STARTPTS`
    : `atrim=0:${targetSec.toFixed(3)},asetpts=PTS-STARTPTS`;

  await execFileAsync('ffmpeg', ['-y', '-i', inputPath, '-filter:a', filter, outputPath]);
}

export async function buildVoiceoverTrack(
  cues: SrtCue[],
  voice: string,
  workDir: string,
  videoDurationSec: number,
): Promise<string> {
  await mkdir(workDir, { recursive: true });
  const segmentPaths: string[] = [];

  for (const cue of cues) {
    const rawPath = path.join(workDir, `cue-${cue.index}-raw.mp3`);
    const fittedPath = path.join(workDir, `cue-${cue.index}.mp3`);
    const slotSec = Math.max((cue.endMs - cue.startMs) / 1000, 0.5);
    const narration = cue.title || cue.text;

    await synthesizeSpeech(narration, voice, rawPath);
    await fitAudioToSlot(rawPath, fittedPath, slotSec);
    segmentPaths.push(fittedPath);
  }

  const outputPath = path.join(workDir, 'voiceover.mp3');
  const filterParts: string[] = [];
  const mixLabels: string[] = [];

  segmentPaths.forEach((_, index) => {
    const cue = cues[index];
    const label = `v${index}`;
    const voiceStartMs = cue.startMs + NARRATION_LEAD_MS;
    filterParts.push(
      `[${index}:a]aformat=channel_layouts=mono,adelay=${voiceStartMs}|${voiceStartMs},apad=whole_dur=${videoDurationSec.toFixed(2)}[${label}]`,
    );
    mixLabels.push(`[${label}]`);
  });

  const filterComplex = `${filterParts.join(';')};${mixLabels.join('')}amix=inputs=${segmentPaths.length}:duration=longest:normalize=0[voice]`;

  await execFileAsync('ffmpeg', [
    '-y',
    ...segmentPaths.flatMap((segment) => ['-i', segment]),
    '-filter_complex',
    filterComplex,
    '-map',
    '[voice]',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ]);

  return outputPath;
}

export async function muxVideoMusicVoiceover(options: {
  silentVideoPath: string;
  musicPath: string;
  voiceoverPath: string;
  webmOutput: string;
  mp4Output: string;
  musicVolume: number;
  videoDurationSec: number;
}): Promise<void> {
  const {
    silentVideoPath,
    musicPath,
    voiceoverPath,
    webmOutput,
    mp4Output,
    musicVolume,
    videoDurationSec,
  } = options;
  const fadeOutStart = Math.max(0, videoDurationSec - 2).toFixed(2);
  const durationLabel = videoDurationSec.toFixed(2);

  const audioFilter = [
    `[1:a]volume=${musicVolume},afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutStart}:d=2,atrim=0:${durationLabel}[music]`,
    `[2:a]aformat=channel_layouts=mono,volume=1.15,asplit=2[vsc][vmix]`,
    `[music][vsc]sidechaincompress=threshold=0.02:ratio=6:attack=80:release=600:makeup=1[mduck]`,
    `[mduck][vmix]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
  ].join(';');

  for (const [outputPath, videoCodec, audioCodec, extraVideoArgs] of [
    [webmOutput, 'libvpx-vp9', 'libopus', ['-b:v', '2M']] as const,
    [mp4Output, 'libx264', 'aac', ['-preset', 'fast', '-crf', '23']] as const,
  ]) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      silentVideoPath,
      '-stream_loop',
      '-1',
      '-i',
      musicPath,
      '-i',
      voiceoverPath,
      '-filter_complex',
      audioFilter,
      '-map',
      '0:v:0',
      '-map',
      '[aout]',
      '-c:v',
      videoCodec,
      ...extraVideoArgs,
      '-c:a',
      audioCodec,
      '-b:a',
      '192k',
      '-shortest',
      outputPath,
    ]);
  }
}

export async function generateVoiceoverForFlow(
  flow: FlowDefinition,
  outputDir: string,
): Promise<{ voiceoverPath: string; voice: string }> {
  const srtPath = path.join(outputDir, 'captions.srt');
  const silentVideoPath = path.join(outputDir, 'flow-silent.webm');
  const voice = flow.video?.voice ?? DEFAULT_VOICE;
  const musicVolume = flow.video?.music_volume_with_voice
    ?? (flow.video?.music_volume ?? 0.45) * 0.22;
  const musicPath = path.resolve(flow.video?.music ?? 'assets/music/background.mp3');

  const srtContent = await readFile(srtPath, 'utf8');
  const cues = parseSrt(srtContent);
  const videoDurationSec = await getMediaDurationSeconds(silentVideoPath);
  const workDir = path.join(outputDir, 'voiceover-work');

  console.log(`Synthesizing voiceover (${voice}) for ${cues.length} cues…`);
  const voiceoverPath = await buildVoiceoverTrack(cues, voice, workDir, videoDurationSec);

  await muxVideoMusicVoiceover({
    silentVideoPath,
    musicPath,
    voiceoverPath,
    webmOutput: path.join(outputDir, 'flow.webm'),
    mp4Output: path.join(outputDir, 'flow.mp4'),
    musicVolume,
    videoDurationSec,
  });

  console.log(`Voiceover saved → ${path.join(outputDir, 'flow.mp4')}`);
  return { voiceoverPath, voice };
}
