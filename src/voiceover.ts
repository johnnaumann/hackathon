import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EdgeTTS } from 'edge-tts-universal';
import { parseSrt, type SrtCue } from './srt.js';
import type { FlowDefinition } from './types.js';

const execFileAsync = promisify(execFile);

export const DEFAULT_VOICE = 'en-GB-SoniaNeural';
/** Slightly slower than default — clearer and more natural for walkthroughs. */
export const DEFAULT_VOICE_RATE = '-4%';
export const DEFAULT_VOICE_PITCH = '+0Hz';
/** Minimum gap before the next cue's narration begins. */
const CUE_GAP_MS = 80;

export type VoiceProsody = {
  rate?: string;
  pitch?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply TTS-only substitutions (captions and guides keep the original spelling). */
export function applyPronunciations(
  text: string,
  pronunciations: Record<string, string> = {},
): string {
  let result = text;
  const entries = Object.entries(pronunciations).sort(([a], [b]) => b.length - a.length);

  for (const [from, to] of entries) {
    const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b(?!\\.)`, 'gi');
    result = result.replace(pattern, to);
  }

  return result;
}

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
  prosody: VoiceProsody = {},
): Promise<void> {
  const tts = new EdgeTTS(text, voice, {
    rate: prosody.rate ?? DEFAULT_VOICE_RATE,
    pitch: prosody.pitch ?? DEFAULT_VOICE_PITCH,
  });
  const result = await tts.synthesize();
  const buffer = Buffer.from(await result.audio.arrayBuffer());
  await writeFile(outputPath, buffer);
}

/**
 * Keep narration at natural speed. If it runs past the available window, fade out
 * gently — never time-stretch or speed up.
 */
async function prepareNarrationAudio(
  inputPath: string,
  outputPath: string,
  maxDurationSec: number,
): Promise<void> {
  const duration = await getMediaDurationSeconds(inputPath);

  if (duration <= maxDurationSec + 0.02) {
    await copyFile(inputPath, outputPath);
    return;
  }

  const fadeDur = Math.min(0.25, maxDurationSec * 0.1);
  const fadeStart = Math.max(0, maxDurationSec - fadeDur);

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-filter:a',
    `afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDur.toFixed(3)},atrim=0:${maxDurationSec.toFixed(3)},asetpts=PTS-STARTPTS`,
    outputPath,
  ]);
}

function maxNarrationSeconds(
  cue: SrtCue,
  cueIndex: number,
  cues: SrtCue[],
  videoDurationSec: number,
): number {
  const voiceStartMs = cue.startMs;
  const nextVoiceStartMs =
    cueIndex + 1 < cues.length ? cues[cueIndex + 1].startMs : videoDurationSec * 1000;

  const availableMs = nextVoiceStartMs - voiceStartMs - CUE_GAP_MS;
  return Math.max(0.5, availableMs / 1000);
}

export async function buildVoiceoverTrack(
  cues: SrtCue[],
  voice: string,
  workDir: string,
  videoDurationSec: number,
  prosody: VoiceProsody = {},
  pronunciations: Record<string, string> = {},
): Promise<string> {
  await mkdir(workDir, { recursive: true });
  const segmentPaths: string[] = [];

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const rawPath = path.join(workDir, `cue-${cue.index}-raw.mp3`);
    const preparedPath = path.join(workDir, `cue-${cue.index}.mp3`);
    const maxDurationSec = maxNarrationSeconds(cue, index, cues, videoDurationSec);
    const narration = applyPronunciations(cue.title || cue.text, pronunciations);

    await synthesizeSpeech(narration, voice, rawPath, prosody);
    await prepareNarrationAudio(rawPath, preparedPath, maxDurationSec);
    segmentPaths.push(preparedPath);
  }

  const outputPath = path.join(workDir, 'voiceover.mp3');
  const filterParts: string[] = [];
  const mixLabels: string[] = [];

  segmentPaths.forEach((_, index) => {
    const cue = cues[index];
    const label = `v${index}`;
    filterParts.push(
      `[${index}:a]aformat=channel_layouts=mono,adelay=${cue.startMs}|${cue.startMs},apad=whole_dur=${videoDurationSec.toFixed(2)}[${label}]`,
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
    `[2:a]aformat=channel_layouts=mono,volume=1.0,asplit=2[vsc][vmix]`,
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
  const prosody: VoiceProsody = {
    rate: flow.video?.voice_rate ?? DEFAULT_VOICE_RATE,
    pitch: flow.video?.voice_pitch ?? DEFAULT_VOICE_PITCH,
  };
  const pronunciations = flow.video?.pronunciations ?? {};
  const musicVolume = flow.video?.music_volume_with_voice
    ?? (flow.video?.music_volume ?? 0.45) * 0.22;
  const musicPath = path.resolve(flow.video?.music ?? 'assets/music/background.mp3');

  const srtContent = await readFile(srtPath, 'utf8');
  const cues = parseSrt(srtContent);
  const videoDurationSec = await getMediaDurationSeconds(silentVideoPath);
  const workDir = path.join(outputDir, 'voiceover-work');

  console.log(`Synthesizing voiceover (${voice}, ${prosody.rate}) for ${cues.length} cues…`);
  const voiceoverPath = await buildVoiceoverTrack(
    cues,
    voice,
    workDir,
    videoDurationSec,
    prosody,
    pronunciations,
  );

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
