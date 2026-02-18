import { describe, expect, it } from 'vitest';
import {
  isRenderablePartialHtml,
  shouldApplyPartialRenderPreview,
  shouldUseScriptStrippedPreview,
} from '../services/streamingUiPolicy';

describe('streaming UI policy', () => {
  it('keeps existing DOM mode at turn start until new HTML arrives', () => {
    expect(
      shouldUseScriptStrippedPreview({
        isLoading: true,
        replayActive: false,
        htmlChangedThisRender: false,
      }),
    ).toBe(false);
  });

  it('switches to script-stripped preview after new streaming HTML arrives', () => {
    expect(
      shouldUseScriptStrippedPreview({
        isLoading: true,
        replayActive: false,
        htmlChangedThisRender: true,
      }),
    ).toBe(true);
  });

  it('always uses script-stripped markup during timeline replay', () => {
    expect(
      shouldUseScriptStrippedPreview({
        isLoading: false,
        replayActive: true,
        htmlChangedThisRender: false,
      }),
    ).toBe(true);
  });

  it('rejects empty or incomplete partial HTML for preview replacement', () => {
    expect(isRenderablePartialHtml('')).toBe(false);
    expect(isRenderablePartialHtml('   ')).toBe(false);
    expect(isRenderablePartialHtml('<div class="card">')).toBe(false);
  });

  it('accepts partial HTML once visible content is present', () => {
    expect(isRenderablePartialHtml('<div>Hello</div>')).toBe(true);
    expect(isRenderablePartialHtml('<section><button>Run</button></section>')).toBe(true);
  });

  it('applies partial preview only when content changed and renderable', () => {
    expect(
      shouldApplyPartialRenderPreview({
        partialHtml: '<div class="card">',
        previousHtml: '<div>Previous</div>',
      }),
    ).toBe(false);

    expect(
      shouldApplyPartialRenderPreview({
        partialHtml: '<div>Updated</div>',
        previousHtml: '<div>Previous</div>',
      }),
    ).toBe(true);

    expect(
      shouldApplyPartialRenderPreview({
        partialHtml: '<div>Updated</div>',
        previousHtml: '<div>Updated</div>',
      }),
    ).toBe(false);
  });

  it('rejects regressive partial replacements when prior screen is substantial', () => {
    const previousHtml = `
      <section class="dashboard">
        <header><h2>Workspace Dashboard</h2><p>Recent files and tasks</p></header>
        <main>
          <div class="card">Open Documents</div>
          <div class="card">Pinned Notes</div>
          <div class="card">Activity Feed</div>
        </main>
      </section>
    `;

    expect(
      shouldApplyPartialRenderPreview({
        partialHtml: '<div>..</div>',
        previousHtml,
      }),
    ).toBe(false);

    expect(
      shouldApplyPartialRenderPreview({
        partialHtml: '<section><div>Still loading</div></section>',
        previousHtml,
      }),
    ).toBe(false);
  });
});
