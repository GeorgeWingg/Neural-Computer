import type { GenerationTimelineFrame } from '../types';

export function getLatestReasoningPreview(
  generationTimelineFrames: GenerationTimelineFrame[] = [],
  maxChars = 320,
): string {
  const frames = Array.isArray(generationTimelineFrames) ? generationTimelineFrames : [];
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    if (!frame || frame.type !== 'thought') continue;
    const detail = typeof frame.detail === 'string' ? frame.detail.trim() : '';
    if (!detail) continue;
    if (detail.startsWith('[System]')) continue;
    if (detail.length <= maxChars) return detail;
    return `${detail.slice(0, Math.max(80, maxChars - 3)).trimEnd()}...`;
  }
  return '';
}

