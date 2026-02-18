import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tauriConfigPath = path.join(rootDir, 'src-tauri', 'tauri.release.conf.json');

function isAppleEventsPermissionError(message) {
  if (!message) return false;
  return /not authorized to send apple events to finder/i.test(message) || /\(-1743\)/i.test(message);
}

async function runCommand(cmd, args) {
  const result = await execFileAsync(cmd, args, {
    cwd: rootDir,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureAppBundleExists() {
  const raw = await fs.readFile(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8');
  const config = JSON.parse(raw);
  const productName = config.productName || 'Neural OS';
  const appPath = path.join(
    rootDir,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'macos',
    `${productName}.app`,
  );
  return pathExists(appPath);
}

async function runTauriBuild(bundles) {
  await runCommand('npx', ['tauri', 'build', '--config', tauriConfigPath, '--bundles', bundles]);
}

async function runFallbackDmgBuild() {
  await runCommand('node', ['scripts/build-dmg-fallback.mjs']);
}

async function run() {
  const modeRaw = String(process.env.NEURAL_OS_DMG_MODE || 'auto').trim().toLowerCase();
  const mode = modeRaw === 'tauri' || modeRaw === 'fallback' || modeRaw === 'auto' ? modeRaw : 'auto';

  if (mode === 'tauri') {
    await runTauriBuild('app,dmg');
    return;
  }

  if (mode === 'fallback') {
    await runTauriBuild('app');
    await runFallbackDmgBuild();
    return;
  }

  try {
    await runTauriBuild('app,dmg');
  } catch (error) {
    const combinedMessage = [
      error instanceof Error ? error.message : String(error),
      typeof error?.stdout === 'string' ? error.stdout : '',
      typeof error?.stderr === 'string' ? error.stderr : '',
    ]
      .filter(Boolean)
      .join('\n');

    const appBundleExists = await ensureAppBundleExists();
    if (!appBundleExists) {
      throw error;
    }

    const fallbackReason = isAppleEventsPermissionError(combinedMessage)
      ? 'Finder Apple Events denied'
      : 'Tauri DMG bundling failed';
    process.stderr.write(`[build-release] ${fallbackReason}, switching to fallback DMG packaging.\n`);
    await runFallbackDmgBuild();
  }
}

run().catch((error) => {
  console.error('[build-release] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
