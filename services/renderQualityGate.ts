/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { RenderQualityResult } from '../types';

const DESKTOP_REQUIRED_APP_IDS = [
  'documents',
  'notepad_app',
  'web_browser_app',
  'gallery_app',
  'videos_app',
  'calculator_app',
  'calendar_app',
  'gaming_app',
  'trash_bin',
  'insights_app',
  'system_settings_page',
];

function countMatches(source: string, pattern: RegExp): number {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function countDesktopCoverage(html: string): number {
  return DESKTOP_REQUIRED_APP_IDS.filter((id) => html.includes(`data-interaction-id="${id}"`) || html.includes(`data-interaction-id='${id}'`)).length;
}

function buildCorrectiveHint(reasonCodes: string[], appContext: string | null): string {
  if (!reasonCodes.length) return '';
  const parts: string[] = [];
  if (reasonCodes.includes('missing_viewport_fill')) {
    parts.push('Use a root container with min-height:100%, height:100%, or min-height:100vh that fills the full window.');
  }
  if (reasonCodes.includes('missing_launcher_coverage')) {
    parts.push('Render a full desktop launcher with clear tiles for all core apps and data-interaction-id values.');
  }
  if (reasonCodes.includes('sparse_interactivity')) {
    parts.push('Add more meaningful interactive controls; avoid static-only output.');
  }
  if (reasonCodes.includes('empty_dark_surface')) {
    parts.push('Avoid plain black empty surfaces; add wallpaper, gradients, or filled content regions.');
  }
  if (reasonCodes.includes('emoji_heavy_default')) {
    parts.push('Use text/symbol icon labels by default; avoid emoji-only icon sets unless explicitly requested.');
  }
  if (reasonCodes.includes('content_too_short')) {
    parts.push('Provide a complete screen layout with structure, spacing, and functional controls.');
  }

  if (!parts.length) {
    parts.push('Regenerate with a complete, interactive, viewport-filling layout and stronger visual hierarchy.');
  }

  return `Quality retry hint for ${appContext || 'unknown_app'}: ${parts.join(' ')}`;
}

export function evaluateGeneratedHtml(html: string, appContext: string | null): RenderQualityResult {
  const normalized = (html || '').trim();
  const reasonCodes: string[] = [];

  const hasHtmlTags = /<[a-zA-Z]/.test(normalized);
  if (!hasHtmlTags) {
    reasonCodes.push('missing_html_structure');
  }

  const interactionCount = countMatches(normalized, /data-interaction-id\s*=\s*["']/gi);
  const hasFullHeightPattern = /(?:min-height|height)\s*:\s*(?:100vh|100%)/i.test(normalized);
  const hasBackgroundVisual = /background(?:-image)?\s*:[^;]*(?:url\(|gradient)/i.test(normalized);
  const blackBackgroundHints = countMatches(normalized, /(?:#000(?:000)?|\bblack\b|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/gi);
  const emojiCount = countMatches(normalized, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);

  if (!appContext || appContext === 'desktop_env') {
    const desktopCoverage = countDesktopCoverage(normalized);
    if (desktopCoverage < 8) reasonCodes.push('missing_launcher_coverage');
    if (!hasFullHeightPattern) reasonCodes.push('missing_viewport_fill');
    if (interactionCount < 8) reasonCodes.push('sparse_interactivity');
    if (blackBackgroundHints >= 2 && !hasBackgroundVisual) reasonCodes.push('empty_dark_surface');
    if (emojiCount > 3) reasonCodes.push('emoji_heavy_default');
  } else {
    if (normalized.length < 120) reasonCodes.push('content_too_short');
    if (interactionCount < 1 && appContext !== 'videos_app') reasonCodes.push('sparse_interactivity');
  }

  let score = 1;
  for (const code of reasonCodes) {
    if (code === 'missing_html_structure') score -= 0.6;
    else if (code === 'missing_viewport_fill') score -= 0.25;
    else if (code === 'missing_launcher_coverage') score -= 0.25;
    else if (code === 'empty_dark_surface') score -= 0.2;
    else if (code === 'sparse_interactivity') score -= 0.2;
    else if (code === 'emoji_heavy_default') score -= 0.1;
    else if (code === 'content_too_short') score -= 0.2;
  }

  const pass = score >= 0.55 && !reasonCodes.includes('missing_html_structure');

  return {
    pass,
    score: Math.max(0, Number(score.toFixed(3))),
    reasonCodes,
    correctiveHint: buildCorrectiveHint(reasonCodes, appContext),
  };
}
