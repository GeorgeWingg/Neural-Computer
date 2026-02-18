import type { RuntimeBootstrapStatus } from '../types';

const TAURI_DEFAULT_API_ORIGIN = 'http://127.0.0.1:8787';

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'tauri:') return true;
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri');
}

function readMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeRuntimeBootstrapStatus(
  value: unknown,
  fallbackMessage?: string,
): RuntimeBootstrapStatus {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const available = Boolean(record.available);
  const status = readMessage(record.status) || (available ? 'ready' : 'error');
  const launchMode = readMessage(record.launchMode) || readMessage(record.launch_mode) || 'unknown';
  const message = readMessage(record.message) || fallbackMessage;
  const checkedAtMsRaw = Number(record.checkedAtMs ?? record.checked_at_ms ?? Date.now());
  const checkedAtMs = Number.isFinite(checkedAtMsRaw) ? Math.max(0, Math.floor(checkedAtMsRaw)) : Date.now();

  return {
    available,
    status,
    launchMode,
    message,
    checkedAtMs,
  };
}

function buildRuntimeFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `Runtime health check failed: ${error.message}`;
  }
  return 'Runtime health check failed.';
}

async function probeRuntimeHealthViaHttp(): Promise<RuntimeBootstrapStatus> {
  try {
    const response = await fetch(`${TAURI_DEFAULT_API_ORIGIN}/api/health`, { method: 'GET' });
    if (response.ok) {
      return normalizeRuntimeBootstrapStatus({
        available: true,
        status: 'ready',
        launchMode: 'http-probe',
        checkedAtMs: Date.now(),
      });
    }
    return normalizeRuntimeBootstrapStatus(
      {
        available: false,
        status: 'error',
        launchMode: 'http-probe',
        checkedAtMs: Date.now(),
      },
      `Runtime health endpoint returned HTTP ${response.status}.`,
    );
  } catch (error) {
    return normalizeRuntimeBootstrapStatus(
      {
        available: false,
        status: 'error',
        launchMode: 'http-probe',
        checkedAtMs: Date.now(),
      },
      buildRuntimeFetchErrorMessage(error),
    );
  }
}

export async function getRuntimeBootstrapStatus(): Promise<RuntimeBootstrapStatus> {
  if (!isTauriRuntime()) {
    return normalizeRuntimeBootstrapStatus({
      available: true,
      status: 'ready',
      launchMode: 'web',
      checkedAtMs: Date.now(),
    });
  }

  try {
    const coreModule: any = await import('@tauri-apps/api/core');
    if (typeof coreModule.invoke === 'function') {
      const response = await coreModule.invoke('runtime_bootstrap_status');
      return normalizeRuntimeBootstrapStatus(response);
    }
  } catch (error) {
    return normalizeRuntimeBootstrapStatus(
      {
        available: false,
        status: 'error',
        launchMode: 'tauri-command',
        checkedAtMs: Date.now(),
      },
      error instanceof Error
        ? `Failed to query runtime status: ${error.message}`
        : 'Failed to query runtime status.',
    );
  }

  return probeRuntimeHealthViaHttp();
}

export async function retryRuntimeBootstrap(): Promise<RuntimeBootstrapStatus> {
  if (!isTauriRuntime()) {
    return getRuntimeBootstrapStatus();
  }

  try {
    const coreModule: any = await import('@tauri-apps/api/core');
    if (typeof coreModule.invoke === 'function') {
      const response = await coreModule.invoke('runtime_retry_bootstrap');
      return normalizeRuntimeBootstrapStatus(response);
    }
    return normalizeRuntimeBootstrapStatus(
      {
        available: false,
        status: 'error',
        launchMode: 'tauri-command',
        checkedAtMs: Date.now(),
      },
      'Runtime retry command is unavailable in this build.',
    );
  } catch (error) {
    return normalizeRuntimeBootstrapStatus(
      {
        available: false,
        status: 'error',
        launchMode: 'tauri-command',
        checkedAtMs: Date.now(),
      },
      error instanceof Error
        ? `Runtime restart attempt failed: ${error.message}`
        : 'Runtime restart attempt failed.',
    );
  }
}
