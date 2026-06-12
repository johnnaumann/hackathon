import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { muxBackgroundMusic } from '../src/video.js';
import { generateVoiceoverForFlow } from '../src/voiceover.js';
import type { FlowResult } from '../src/types.js';

const outputDir = path.resolve('output/contact-from-home');
const result = JSON.parse(
  await readFile(path.join(outputDir, 'flow-result.json'), 'utf8'),
) as FlowResult;

const silentPath = path.join(outputDir, 'flow-silent.mp4');

if (result.flow.video?.voiceover) {
  await generateVoiceoverForFlow(result.flow, outputDir);
} else {
  const musicPath = path.resolve(result.flow.video?.music ?? 'assets/music/background.mp3');
  const musicVolume = result.flow.video?.music_volume ?? 0.45;
  await muxBackgroundMusic(silentPath, musicPath, path.join(outputDir, 'flow.webm'), musicVolume);
  await muxBackgroundMusic(silentPath, musicPath, path.join(outputDir, 'flow.mp4'), musicVolume);
}

console.log('Remuxed audio over the existing silent master.');
