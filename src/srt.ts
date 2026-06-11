export type SrtCue = {
  index: number;
  startMs: number;
  endMs: number;
  /** Full caption text (title + description) */
  text: string;
  /** First line — used for voiceover narration */
  title: string;
};

export function parseSrtTimestamp(timestamp: string): number {
  const [time, millis] = timestamp.trim().split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return ((hours * 3600 + minutes * 60 + seconds) * 1000) + Number(millis);
}

export function parseSrt(content: string): SrtCue[] {
  const blocks = content.trim().split(/\n\s*\n/);

  return blocks.map((block) => {
    const lines = block.trim().split('\n');
    const index = Number(lines[0]);
    const [start, end] = lines[1].split('-->').map((part) => part.trim());
    const bodyLines = lines.slice(2);
    const title = bodyLines[0]?.trim() ?? '';
    const text = bodyLines.join(' ').trim();

    return {
      index,
      startMs: parseSrtTimestamp(start),
      endMs: parseSrtTimestamp(end),
      text,
      title,
    };
  });
}
