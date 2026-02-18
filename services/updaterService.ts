import type { UpdaterState } from '../types';

let pendingUpdate: any | null = null;

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol === 'tauri:') return true;
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri');
}

function parseEnvBoolean(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function getCurrentVersion(): Promise<string> {
  if (!isTauriRuntime()) return '0.0.0';
  try {
    const appModule: any = await import('@tauri-apps/api/app');
    if (typeof appModule.getVersion === 'function') {
      return String(await appModule.getVersion());
    }
  } catch {
    // Ignore and fallback.
  }
  return '0.0.0';
}

export function isUpdaterEnabled(): boolean {
  return isTauriRuntime() && parseEnvBoolean((import.meta as any)?.env?.VITE_UPDATER_ENABLED);
}

export async function checkForUpdates(): Promise<UpdaterState> {
  const currentVersion = await getCurrentVersion();

  if (!isUpdaterEnabled()) {
    pendingUpdate = null;
    return {
      enabled: false,
      currentVersion,
      status: 'disabled',
    };
  }

  try {
    const updaterModule: any = await import('@tauri-apps/plugin-updater');
    const check = updaterModule.check || updaterModule.checkUpdate;

    if (typeof check !== 'function') {
      return {
        enabled: true,
        currentVersion,
        status: 'error',
        lastCheckedAt: Date.now(),
        lastError: 'Updater plugin API is unavailable in this build.',
      };
    }

    const update = await check();
    pendingUpdate = update || null;

    if (!update) {
      return {
        enabled: true,
        currentVersion,
        status: 'up-to-date',
        lastCheckedAt: Date.now(),
      };
    }

    const latestVersion =
      typeof update.version === 'string'
        ? update.version
        : typeof update.latestVersion === 'string'
          ? update.latestVersion
          : undefined;

    return {
      enabled: true,
      currentVersion,
      latestVersion,
      status: 'available',
      lastCheckedAt: Date.now(),
    };
  } catch (error) {
    pendingUpdate = null;
    return {
      enabled: true,
      currentVersion,
      status: 'error',
      lastCheckedAt: Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function downloadAndInstallUpdate(): Promise<UpdaterState> {
  const currentVersion = await getCurrentVersion();

  if (!isUpdaterEnabled()) {
    return {
      enabled: false,
      currentVersion,
      status: 'disabled',
    };
  }

  try {
    if (!pendingUpdate) {
      const checkState = await checkForUpdates();
      if (checkState.status !== 'available') {
        return checkState;
      }
    }

    if (!pendingUpdate || typeof pendingUpdate.downloadAndInstall !== 'function') {
      return {
        enabled: true,
        currentVersion,
        status: 'error',
        lastCheckedAt: Date.now(),
        lastError: 'No pending update is available to install.',
      };
    }

    await pendingUpdate.downloadAndInstall();

    try {
      const processModule: any = await import('@tauri-apps/plugin-process');
      if (typeof processModule.relaunch === 'function') {
        await processModule.relaunch();
      }
    } catch {
      // Restart is best-effort.
    }

    pendingUpdate = null;

    return {
      enabled: true,
      currentVersion,
      status: 'installing',
      lastCheckedAt: Date.now(),
    };
  } catch (error) {
    return {
      enabled: true,
      currentVersion,
      status: 'error',
      lastCheckedAt: Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
    };
  }
}
