import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

type FlowMeta = { output_dir: string };

export async function getFlowOutputDir(flowFile = 'contact-from-home.yaml'): Promise<string> {
  const filePath = path.resolve('flows', flowFile);
  const content = await readFile(filePath, 'utf8');
  const flow = parseYaml(content) as FlowMeta;
  return path.resolve(flow.output_dir);
}

export function flowDebugPath(outputDir: string, fileName: string): string {
  return path.join(outputDir, 'debug', fileName);
}
