import React from 'react';

interface RuntimeRecoveryScreenProps {
  message?: string | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  isRetrying?: boolean;
}

export const RuntimeRecoveryScreen: React.FC<RuntimeRecoveryScreenProps> = ({
  message,
  onRetry,
  onOpenSettings,
  isRetrying = false,
}) => {
  return (
    <div
      className="w-full h-full flex items-center justify-center px-8"
      style={{
        background: 'linear-gradient(180deg, rgba(247,248,250,0.98) 0%, rgba(241,243,247,0.98) 100%)',
      }}
    >
      <div className="w-full max-w-3xl flex flex-col items-center text-center">
        <img
          src="/logo-mark.svg"
          alt="Neural OS"
          style={{
            width: '110px',
            height: '110px',
            objectFit: 'contain',
            marginBottom: '22px',
          }}
        />

        <h1
          style={{
            margin: 0,
            color: '#111827',
            fontSize: '62px',
            lineHeight: 1.02,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            fontFamily: "'Orbitron', 'Avenir Next', 'Segoe UI', sans-serif",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            marginTop: '16px',
            marginBottom: '26px',
            color: '#4b5563',
            fontSize: '32px',
            lineHeight: 1.2,
            fontWeight: 500,
            fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          Try again or open settings.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="rounded-2xl px-7 py-3 text-xl font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(180deg, #1f3c88 0%, #162d66 100%)',
              color: '#f8fafc',
              border: '1px solid rgba(15,23,42,0.32)',
              boxShadow: '0 8px 22px rgba(23, 37, 84, 0.22)',
              fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {isRetrying ? 'Retrying...' : 'Try again'}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-2xl px-7 py-3 text-xl font-semibold transition-all hover:brightness-[0.98]"
            style={{
              background: '#eef2f7',
              color: '#1f2937',
              border: '1px solid rgba(148, 163, 184, 0.48)',
              boxShadow: '0 8px 20px rgba(148, 163, 184, 0.2)',
              fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            Open settings
          </button>
        </div>

        <details
          style={{
            marginTop: '16px',
            width: '100%',
            maxWidth: '760px',
            textAlign: 'left',
            borderRadius: '12px',
            border: '1px solid #d1d5db',
            background: 'rgba(255,255,255,0.75)',
            padding: '12px 14px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              color: '#1f2937',
              fontWeight: 650,
              listStyle: 'none',
              fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            Technical details
          </summary>
          <pre
            style={{
              marginTop: '10px',
              marginBottom: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#4b5563',
              fontSize: '12px',
              lineHeight: 1.45,
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
            }}
          >
            {message?.trim() || 'No additional error details were provided.'}
          </pre>
        </details>
      </div>
    </div>
  );
};
