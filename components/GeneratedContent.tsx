/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColorTheme, InteractionData } from '../types';

interface LoadingTheme {
  bg: string;
  text: string;
  textMuted: string;
  codeBg: string;
  codeText: string;
  progressBg: string;
  progressFill: string;
  skeletonBase: string;
  skeletonShine: string;
  statusBorder: string;
  statusText: string;
  reasoningBg: string;
  reasoningBorder: string;
  reasoningLabel: string;
}

interface IframeBaseTheme {
  bg: string;
  text: string;
  controlSurface: string;
  controlBorder: string;
  placeholder: string;
  buttonHover: string;
}

function getLoadingTheme(colorTheme: ColorTheme): LoadingTheme {
  if (colorTheme === 'dark') {
    return {
      bg: '#1e1e2e',
      text: '#cdd6f4',
      textMuted: '#a6adc8',
      codeBg: '#1e1e2e',
      codeText: '#cdd6f4',
      progressBg: '#313244',
      progressFill: 'linear-gradient(90deg, #89b4fa, #b4befe, #cba6f7)',
      skeletonBase: 'linear-gradient(90deg, #313244 25%, #45475a 50%, #313244 75%)',
      skeletonShine: '#45475a',
      statusBorder: '#313244',
      statusText: '#585b70',
      reasoningBg: '#313244',
      reasoningBorder: '#cba6f7',
      reasoningLabel: '#cba6f7',
    };
  }
  if (colorTheme === 'colorful') {
    return {
      bg: 'linear-gradient(135deg, #1a1333 0%, #1e1e4e 40%, #2a1a3e 100%)',
      text: '#e0d6ff',
      textMuted: '#b8a9e0',
      codeBg: 'rgba(30, 20, 60, 0.6)',
      codeText: '#e0d6ff',
      progressBg: 'rgba(255,255,255,0.1)',
      progressFill: 'linear-gradient(90deg, #ff6ec7, #a855f7, #6366f1, #38bdf8)',
      skeletonBase: 'linear-gradient(90deg, rgba(168,85,247,0.15) 25%, rgba(99,102,241,0.25) 50%, rgba(168,85,247,0.15) 75%)',
      skeletonShine: 'rgba(168,85,247,0.3)',
      statusBorder: 'rgba(168,85,247,0.3)',
      statusText: '#b8a9e0',
      reasoningBg: 'rgba(168,85,247,0.12)',
      reasoningBorder: '#a855f7',
      reasoningLabel: '#c084fc',
    };
  }
  // light or system
  return {
    bg: '#f8f9fa',
    text: '#1e1e2e',
    textMuted: '#6b7280',
    codeBg: '#ffffff',
    codeText: '#1e1e2e',
    progressBg: '#e5e7eb',
    progressFill: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
    skeletonBase: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
    skeletonShine: '#f3f4f6',
    statusBorder: '#e5e7eb',
    statusText: '#9ca3af',
    reasoningBg: '#f3f4f6',
    reasoningBorder: '#8b5cf6',
    reasoningLabel: '#7c3aed',
  };
}

function getIframeBaseTheme(colorTheme: ColorTheme): IframeBaseTheme {
  if (colorTheme === 'dark') {
    return {
      bg: 'radial-gradient(140% 100% at 50% 0%, #17263c 0%, #0d1627 60%, #0a1220 100%)',
      text: '#e5ecff',
      controlSurface: 'rgba(15, 23, 42, 0.78)',
      controlBorder: 'rgba(148, 163, 184, 0.35)',
      placeholder: 'rgba(203, 213, 225, 0.8)',
      buttonHover: 'rgba(59, 130, 246, 0.28)',
    };
  }
  if (colorTheme === 'colorful') {
    return {
      bg: 'radial-gradient(140% 100% at 50% 0%, #1d4ed8 0%, #3730a3 55%, #312e81 100%)',
      text: '#eef2ff',
      controlSurface: 'rgba(30, 41, 59, 0.74)',
      controlBorder: 'rgba(165, 180, 252, 0.45)',
      placeholder: 'rgba(224, 231, 255, 0.85)',
      buttonHover: 'rgba(129, 140, 248, 0.35)',
    };
  }
  return {
    bg: 'radial-gradient(160% 120% at 50% 0%, #e2e8f0 0%, #dbeafe 46%, #c7d2fe 100%)',
    text: '#0f172a',
    controlSurface: 'rgba(255, 255, 255, 0.76)',
    controlBorder: 'rgba(59, 130, 246, 0.28)',
    placeholder: 'rgba(30, 41, 59, 0.55)',
    buttonHover: 'rgba(59, 130, 246, 0.16)',
  };
}

interface GeneratedContentProps {
  htmlContent: string;
  onInteract: (data: InteractionData) => void;
  appContext: string | null;
  isLoading: boolean;
  appName?: string;
  appIcon?: string;
  colorTheme?: ColorTheme;
  traceId?: string;
  uiSessionId?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function estimateProgress(content: string, isLoading: boolean): number {
  if (!isLoading) return 100;
  if (!content) return 2;

  let progress = 5;

  // Use content length as early signal
  if (content.length > 100) progress = Math.max(progress, 10);
  if (content.length > 500) progress = Math.max(progress, 15);
  if (content.length > 1000) progress = Math.max(progress, 20);

  const firstTagIndex = content.search(/<[a-zA-Z]/);
  if (firstTagIndex === -1) {
    return Math.min(25, progress + Math.min(content.length / 50, 10));
  }

  progress = Math.max(progress, 28);

  // Style phase
  const styleStart = content.search(/<style/i);
  if (styleStart !== -1) {
    progress = Math.max(progress, 35);
    const styleEnd = content.search(/<\/style>/i);
    if (styleEnd === -1) {
      // Still inside style tag - estimate by content after <style
      const styleContent = content.substring(styleStart);
      if (styleContent.length > 200) progress = Math.max(progress, 40);
      if (styleContent.length > 600) progress = Math.max(progress, 45);
    } else {
      progress = Math.max(progress, 50);
    }
  }

  // Body element markers
  const divCount = (content.match(/<div[\s>]/gi) || []).length;
  const buttonCount = (content.match(/<button[\s>]/gi) || []).length;
  const interactiveCount = divCount + buttonCount;
  if (interactiveCount > 2) progress = Math.max(progress, 55);
  if (interactiveCount > 5) progress = Math.max(progress, 60);
  if (interactiveCount > 10) progress = Math.max(progress, 65);

  // Script phase
  const scriptStart = content.search(/<script/i);
  if (scriptStart !== -1) {
    progress = Math.max(progress, 72);
    const scriptContent = content.substring(scriptStart);
    if (/function\s/.test(scriptContent)) progress = Math.max(progress, 76);
    if (/addEventListener|querySelector/.test(scriptContent)) progress = Math.max(progress, 80);
    if (/\.style\.|\.classList|innerHTML/.test(scriptContent)) progress = Math.max(progress, 84);
    if (scriptContent.length > 800) progress = Math.max(progress, 88);

    if (/<\/script>/i.test(content)) {
      progress = Math.max(progress, 93);
      // Content after closing script tag
      const afterScript = content.substring(content.search(/<\/script>/i) + 9);
      if (afterScript.trim().length > 10) progress = Math.max(progress, 96);
    }
  }

  return progress;
}

function stripScriptsForPreview(markup: string): string {
  const withoutClosedScripts = markup.replace(/<script[\s\S]*?<\/script>/gi, '');
  return withoutClosedScripts.replace(/<script[\s\S]*$/gi, '');
}

function buildBridgeScript(uiSessionId: string, bridgeToken: string): string {
  return `
  (function() {
    var sessionId = ${JSON.stringify(uiSessionId)};
    var token = ${JSON.stringify(bridgeToken)};
    function post(payload) {
      window.parent.postMessage({
        type: 'gemini-os-interaction',
        uiSessionId: sessionId,
        bridgeToken: token,
        payload: payload
      }, '*');
    }
    try {
      post({ type: 'bridge_ready' });
      document.addEventListener('click', function(e) {
        var target = e.target;
        while (target && target !== document.body) {
          if (target.getAttribute && target.getAttribute('data-interaction-id')) {
            var id = target.getAttribute('data-interaction-id');
            var interactionType = target.getAttribute('data-interaction-type') || '';
            var valueFrom = target.getAttribute('data-value-from');
            var value = target.getAttribute('data-interaction-value') || '';
            if (valueFrom) {
              var inputEl = document.getElementById(valueFrom);
              if (inputEl) value = inputEl.value || inputEl.innerText || '';
            }
            post({
              id: id,
              interactionType: interactionType,
              value: value,
              elementType: target.tagName.toLowerCase(),
              elementText: (target.innerText || '').substring(0, 75)
            });
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
          target = target.parentElement;
        }
      }, true);
    } catch (err) {
      post({ type: 'bridge_error', message: String(err) });
    }
  })();
  `;
}

const CSS_KEYFRAMES = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

export const GeneratedContent: React.FC<GeneratedContentProps> = ({
  htmlContent,
  onInteract,
  appContext,
  isLoading,
  appName,
  appIcon,
  colorTheme: rawColorTheme = 'dark',
  traceId,
  uiSessionId = 'session_unknown',
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [showIframe, setShowIframe] = useState(false);
  const [bridgeToken, setBridgeToken] = useState(() => `bridge_${Math.random().toString(36).slice(2)}`);
  const ambientRef = useRef(0);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamingIframeRef = useRef<HTMLIFrameElement>(null);
  const eventSeqRef = useRef(0);

  const effectiveColorTheme = rawColorTheme as ColorTheme;
  const theme = getLoadingTheme(effectiveColorTheme);
  const rawProgress = estimateProgress(htmlContent, isLoading);

  // Reset state when appContext changes (new app opened)
  useEffect(() => {
    setDisplayProgress(0);
    setSmoothProgress(0);
    setShowIframe(false);
    ambientRef.current = 0;
    eventSeqRef.current = 0;
    setBridgeToken(`bridge_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`);
  }, [appContext]);

  // Handle completion: crossfade to iframe
  useEffect(() => {
    if (!isLoading && htmlContent) {
      setDisplayProgress(100);
      const timer = setTimeout(() => setShowIframe(true), 300);
      return () => clearTimeout(timer);
    }
    if (!htmlContent) {
      setShowIframe(false);
      setDisplayProgress(0);
    }
  }, [isLoading, htmlContent]);

  // Ambient progress nudge — 0.5% every 500ms, cap 3% above last marker
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      ambientRef.current += 0.5;
      setDisplayProgress((prev) => {
        const target = Math.min(rawProgress + ambientRef.current, rawProgress + 3, 98);
        return Math.max(prev, target);
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading, rawProgress]);

  // Update display progress when raw progress jumps
  useEffect(() => {
    ambientRef.current = 0;
    setDisplayProgress((prev) => Math.max(prev, rawProgress));
  }, [rawProgress]);

  // Smooth percentage animation via requestAnimationFrame
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setSmoothProgress(prev => {
        const diff = displayProgress - prev;
        if (Math.abs(diff) < 0.5) return displayProgress;
        return prev + diff * 0.08;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [displayProgress]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (scrollAnchorRef.current && isLoading && htmlContent) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [htmlContent, isLoading]);

  // postMessage listener for iframe interactions
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'gemini-os-interaction') return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.uiSessionId !== uiSessionId) return;
      if (event.data?.bridgeToken !== bridgeToken) return;

      const p = event.data.payload || {};
      if (!p.id || typeof p.id !== 'string') return;

      eventSeqRef.current += 1;
      onInteract({
        id: p.id,
        type: p.interactionType || 'generic_click',
        value: p.value || undefined,
        elementType: p.elementType || 'unknown',
        elementText: p.elementText || p.id,
        appContext: appContext,
        traceId,
        uiSessionId,
        eventSeq: eventSeqRef.current,
        source: 'iframe',
        validationState: 'accepted',
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onInteract, appContext, uiSessionId, bridgeToken, traceId]);

  const contentWithoutThoughts = useMemo(
    () => htmlContent.replace(/<!--THOUGHT-->[\s\S]*?<!--\/THOUGHT-->/g, ''),
    [htmlContent],
  );
  const firstTagIndex = contentWithoutThoughts.search(/<[a-zA-Z]/);
  const code = firstTagIndex >= 0 ? contentWithoutThoughts.substring(firstTagIndex) : '';
  const previewMarkup = useMemo(() => {
    if (!contentWithoutThoughts.trim()) return '';
    if (!/<[a-zA-Z]/.test(contentWithoutThoughts)) {
      return `
        <div style="
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #6b7280;
          background: rgba(255,255,255,0.55);
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          white-space: pre-wrap;
        ">${escapeHtml(contentWithoutThoughts.trim())}</div>
      `;
    }
    return stripScriptsForPreview(contentWithoutThoughts);
  }, [contentWithoutThoughts]);

  const streamingPreviewDoc = useMemo(() => {
    const iframeTheme = getIframeBaseTheme(effectiveColorTheme);
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<style>
  :root { color-scheme: ${effectiveColorTheme === 'dark' ? 'dark' : 'light'}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; min-height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-y: auto;
    background: ${iframeTheme.bg};
    color: ${iframeTheme.text};
  }
  #gemini-streaming-root { width: 100%; min-height: 100%; }
</style>
</head>
<body><div id="gemini-streaming-root"></div></body></html>`;
  }, [effectiveColorTheme]);

  const syncStreamingPreview = useCallback(() => {
    const iframe = streamingIframeRef.current;
    if (!iframe) return;
    const root = iframe.contentDocument?.getElementById('gemini-streaming-root');
    if (!root) return;
    root.innerHTML = previewMarkup;
  }, [previewMarkup]);

  useEffect(() => {
    if (!htmlContent || showIframe) return;
    syncStreamingPreview();
  }, [htmlContent, showIframe, syncStreamingPreview]);

  // Build iframe srcDoc — bridge script injected BEFORE content in <head>
  const iframeDoc = useMemo(() => {
    if (!htmlContent || isLoading) return '';
    const iframeTheme = getIframeBaseTheme(effectiveColorTheme);
    // Check if the content has any HTML tags
    const hasHtml = /<[a-zA-Z]/.test(contentWithoutThoughts);

    // If no HTML, wrap the text in a styled message (AI rejection or plain text response)
    const bodyContent = hasHtml ? contentWithoutThoughts : `
      <div style="
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #374151;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        white-space: pre-wrap;
      ">
        <div style="margin-bottom: 12px; font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          AI Response
        </div>
        ${contentWithoutThoughts.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
    `;

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<style>
  :root {
    --gemini-base-bg: ${iframeTheme.bg};
    --gemini-base-text: ${iframeTheme.text};
    --gemini-control-surface: ${iframeTheme.controlSurface};
    --gemini-control-border: ${iframeTheme.controlBorder};
    --gemini-control-placeholder: ${iframeTheme.placeholder};
    --gemini-control-hover: ${iframeTheme.buttonHover};
    color-scheme: ${effectiveColorTheme === 'dark' ? 'dark' : 'light'};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; min-height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-y: auto;
    background: var(--gemini-base-bg);
    color: var(--gemini-base-text);
  }
  #gemini-generated-root { width: 100%; min-height: 100%; }
  button, input, textarea, select {
    font: inherit;
    color: inherit;
    border-radius: 10px;
    border: 1px solid var(--gemini-control-border);
    background: var(--gemini-control-surface);
  }
  button {
    cursor: pointer;
    transition: background-color 120ms ease-in-out, border-color 120ms ease-in-out;
  }
  button:hover {
    background: var(--gemini-control-hover);
    border-color: color-mix(in srgb, var(--gemini-control-border) 55%, white 45%);
  }
  input, textarea, select {
    padding: 6px 10px;
  }
  input::placeholder, textarea::placeholder {
    color: var(--gemini-control-placeholder);
  }
</style>
<script>${buildBridgeScript(uiSessionId, bridgeToken)}<\/script>
</head>
<body>
<div id="gemini-generated-root">${bodyContent}</div>
</body></html>`;
  }, [htmlContent, isLoading, uiSessionId, bridgeToken, effectiveColorTheme, contentWithoutThoughts]);

  // Status text
  const getStatusText = (): string => {
    if (!htmlContent) return 'Connecting...';
    if (firstTagIndex === -1) return 'Thinking...';
    if (/<script/i.test(code) && !/<\/script>/i.test(code))
      return 'Building interactivity...';
    if (/<style/i.test(code) && !/<\/style>/i.test(code))
      return 'Writing styles...';
    if (/<\/script>/i.test(code)) return 'Finalizing...';
    return 'Generating interface...';
  };

  // Phase 3: Complete - show iframe with crossfade
  if (showIframe && !isLoading && htmlContent) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          animation: 'fadeIn 0.3s ease-in',
        }}
      >
        <style>{CSS_KEYFRAMES}</style>
        <iframe
          ref={iframeRef}
          srcDoc={iframeDoc}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-forms"
          title={appName || 'App Content'}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // No content and not loading
  if (!isLoading && !htmlContent) {
    return null;
  }

  const isGradientBg = effectiveColorTheme === 'colorful';
  // Phase 1 & 2: Loading / Streaming view
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(isGradientBg ? { background: theme.bg } : { background: theme.bg }),
        color: theme.text,
        fontFamily:
          "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
      }}
    >
      <style>{CSS_KEYFRAMES}</style>

      {/* Progress bar */}
      <div style={{ height: '3px', background: theme.progressBg, flexShrink: 0 }}>
        <div
          style={{
            height: '100%',
            width: `${displayProgress}%`,
            background: theme.progressFill,
            transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        {!htmlContent ? (
          /* Phase 1: Initial loading - centered icon + skeleton */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '48px' }}>{appIcon || '...'}</div>
            <div
              style={{
                color: theme.textMuted,
                fontSize: '14px',
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              Connecting...
            </div>
            <div
              style={{
                width: '60%',
                maxWidth: '300px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '20px',
              }}
            >
              {[80, 100, 60, 90].map((w, i) => (
                <div
                  key={i}
                  style={{
                    width: `${w}%`,
                    height: '12px',
                    borderRadius: '6px',
                    background: theme.skeletonBase,
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Phase 2: Streaming content */
          <>
            <div style={{ height: '100%', padding: '10px' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: `1px solid ${theme.statusBorder}`,
                  background: effectiveColorTheme === 'light' || effectiveColorTheme === 'system'
                    ? 'rgba(255, 255, 255, 0.75)'
                    : 'rgba(15, 23, 42, 0.28)',
                }}
              >
                <iframe
                  ref={streamingIframeRef}
                  srcDoc={streamingPreviewDoc}
                  onLoad={syncStreamingPreview}
                  style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                  sandbox="allow-forms allow-same-origin"
                  title={`${appName || 'App Content'} Streaming Preview`}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            {/* Scroll anchor */}
            <div ref={scrollAnchorRef} />
          </>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: '6px 16px',
          borderTop: `1px solid ${theme.statusBorder}`,
          fontSize: '11px',
          color: theme.statusText,
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span>{getStatusText()}</span>
        <span>{Math.round(smoothProgress)}%</span>
      </div>
    </div>
  );
};
