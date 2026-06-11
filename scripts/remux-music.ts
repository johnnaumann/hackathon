import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { finalizeVideo } from '../src/video.js';
import type { FlowResult } from '../src/types.js';

const outputDir = path.resolve('output/contact-from-home');
const result = JSON.parse(
  await readFile(path.join(outputDir, 'flow-result.json'), 'utf8'),
) as FlowResult;

const silentPath = path.join(outputDir, 'flow-silent.webm');
await finalizeVideo(result, silentPath, 0);
await writeFile(path.join(outputDir, 'flow-result.json'), JSON.stringify(result, null, 2));

console.log('Remuxed with updated background music.');
