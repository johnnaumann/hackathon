import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { generateVoiceoverForFlow } from '../src/voiceover.js';
import type { FlowDefinition, FlowResult } from '../src/types.js';

const flowFile = process.argv[2] ?? 'contact-from-home.yaml';
const flowPath = path.resolve('flows', flowFile);
const flow = parseYaml(await readFile(flowPath, 'utf8')) as FlowDefinition;
const outputDir = path.resolve(flow.output_dir);

const { voice } = await generateVoiceoverForFlow(flow, outputDir);

const resultPath = path.join(outputDir, 'flow-result.json');
try {
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as FlowResult;
  result.video = {
    webm: 'flow.webm',
    mp4: 'flow.mp4',
    captions: 'captions.srt',
  };
  await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
} catch {
  // flow-result.json is optional for voiceover-only runs
}

console.log(`Done — narrated video uses voice: ${voice}`);
