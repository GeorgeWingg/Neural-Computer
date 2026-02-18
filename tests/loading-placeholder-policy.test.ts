import { describe, expect, it } from 'vitest';
import { getLatestReasoningPreview } from '../services/loadingPlaceholderPolicy';
import type { GenerationTimelineFrame } from '../types';

function frame(partial: Partial<GenerationTimelineFrame>): GenerationTimelineFrame {
  return {
    id: partial.id || 'frame_test',
    type: partial.type || 'stream',
    createdAt: partial.createdAt || Date.now(),
    label: partial.label || 'test',
    detail: partial.detail,
    htmlSnapshot: partial.htmlSnapshot || '',
    toolName: partial.toolName,
    toolCallId: partial.toolCallId,
    isError: partial.isError,
  };
}

describe('loading placeholder policy', () => {
  it('returns empty string when no thought frames exist', () => {
    const frames: GenerationTimelineFrame[] = [frame({ type: 'start' }), frame({ type: 'stream' })];
    expect(getLatestReasoningPreview(frames)).toBe('');
  });

  it('returns latest non-system thought detail', () => {
    const frames: GenerationTimelineFrame[] = [
      frame({ type: 'thought', detail: 'First reasoning step.' }),
      frame({ type: 'thought', detail: '[System] Tool read_screen completed.' }),
      frame({ type: 'thought', detail: 'Latest reasoning step.' }),
    ];
    expect(getLatestReasoningPreview(frames)).toBe('Latest reasoning step.');
  });

  it('truncates long reasoning previews', () => {
    const longReasoning = 'A'.repeat(500);
    const frames: GenerationTimelineFrame[] = [frame({ type: 'thought', detail: longReasoning })];
    const preview = getLatestReasoningPreview(frames, 120);
    expect(preview.length).toBeLessThanOrEqual(123);
    expect(preview.endsWith('...')).toBe(true);
  });
});

