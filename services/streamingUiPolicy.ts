export const PARTIAL_RENDER_MIN_VISIBLE_TEXT_CHARS = 2;
export const PARTIAL_RENDER_MIN_VISIBLE_HTML_CHARS = 80;
export const PARTIAL_RENDER_MIN_VISIBLE_TEXT_CHARS_ON_REPLACE = 6;
export const PARTIAL_RENDER_MIN_BASELINE_HTML_CHARS_ON_REPLACE = 140;
export const PARTIAL_RENDER_MIN_LENGTH_RATIO_ON_REPLACE = 0.35;

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

function normalizedVisibleTextLength(value: string): number {
  return stripTags(value).replace(/\s+/g, ' ').trim().length;
}

export function shouldUseScriptStrippedPreview(options: {
  isLoading: boolean;
  replayActive: boolean;
  htmlChangedThisRender: boolean;
}): boolean {
  if (options.replayActive) return true;
  // Keep the existing rendered screen stable at turn start. Only switch to
  // script-stripped preview once new HTML for the current turn arrives.
  if (options.isLoading && options.htmlChangedThisRender) return true;
  return false;
}

export function isRenderablePartialHtml(value: string): boolean {
  const html = typeof value === 'string' ? value.trim() : '';
  if (!html) return false;

  const visibleTextLength = normalizedVisibleTextLength(html);
  if (visibleTextLength >= PARTIAL_RENDER_MIN_VISIBLE_TEXT_CHARS) return true;

  if (html.length < PARTIAL_RENDER_MIN_VISIBLE_HTML_CHARS) return false;

  const hasRenderableBlock = /<(div|section|main|article|aside|header|footer|ul|ol|table|form|p|h[1-6]|button|input|textarea|select|canvas|svg)\b/i.test(
    html,
  );
  const hasClosedRenderableBlock = /<\/(div|section|main|article|aside|header|footer|ul|ol|table|form|p|h[1-6]|button|textarea|select|canvas|svg)>/i.test(
    html,
  );
  return hasRenderableBlock && hasClosedRenderableBlock;
}

export function shouldApplyPartialRenderPreview(options: {
  partialHtml: string;
  previousHtml: string;
}): boolean {
  const partialHtml = typeof options.partialHtml === 'string' ? options.partialHtml : '';
  const previousHtml = typeof options.previousHtml === 'string' ? options.previousHtml : '';
  if (partialHtml === previousHtml) return false;
  if (!isRenderablePartialHtml(partialHtml)) return false;

  const partialTrimmed = partialHtml.trim();
  const previousTrimmed = previousHtml.trim();
  if (!previousTrimmed) return true;

  const previousVisibleChars = normalizedVisibleTextLength(previousTrimmed);
  const partialVisibleChars = normalizedVisibleTextLength(partialTrimmed);
  if (
    previousVisibleChars >= PARTIAL_RENDER_MIN_VISIBLE_TEXT_CHARS_ON_REPLACE &&
    partialVisibleChars < PARTIAL_RENDER_MIN_VISIBLE_TEXT_CHARS_ON_REPLACE
  ) {
    return false;
  }

  if (
    previousTrimmed.length >= PARTIAL_RENDER_MIN_BASELINE_HTML_CHARS_ON_REPLACE &&
    partialTrimmed.length < previousTrimmed.length * PARTIAL_RENDER_MIN_LENGTH_RATIO_ON_REPLACE
  ) {
    return false;
  }

  return true;
}
