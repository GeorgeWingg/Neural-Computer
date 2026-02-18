import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function normalizeArchLabel() {
  if (process.arch === 'arm64') return 'aarch64';
  if (process.arch === 'x64') return 'x64';
  return process.arch;
}

function sanitizeFileToken(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readTauriConfig() {
  const raw = await fs.readFile(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8');
  return JSON.parse(raw);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureAppBundle(productName) {
  const appBundlePath = path.join(
    rootDir,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'macos',
    `${productName}.app`,
  );
  if (!(await pathExists(appBundlePath))) {
    throw new Error(`Expected app bundle does not exist: ${appBundlePath}`);
  }
  return appBundlePath;
}

async function createFallbackDmg() {
  const tauriConfig = await readTauriConfig();
  const productName =
    process.env.NEURAL_OS_DMG_PRODUCT_NAME ||
    process.env.NEURAL_COMPUTER_DMG_PRODUCT_NAME ||
    tauriConfig.productName ||
    'Neural OS';
  const version =
    process.env.NEURAL_OS_DMG_VERSION ||
    process.env.NEURAL_COMPUTER_DMG_VERSION ||
    tauriConfig.version ||
    '0.0.0';
  const arch =
    process.env.NEURAL_OS_DMG_ARCH || process.env.NEURAL_COMPUTER_DMG_ARCH || normalizeArchLabel();
  const appBundlePath = await ensureAppBundle(productName);

  const bundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle');
  const dmgDir = path.join(bundleDir, 'dmg');
  const stagingDir = path.join(rootDir, '.tmp', 'dmg-staging');
  await fs.mkdir(dmgDir, { recursive: true });
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  const appBundleName = `${productName}.app`;
  const stagedAppPath = path.join(stagingDir, appBundleName);
  await fs.cp(appBundlePath, stagedAppPath, { recursive: true });

  const applicationsLink = path.join(stagingDir, 'Applications');
  try {
    await fs.symlink('/Applications', applicationsLink);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/EEXIST/i.test(message)) throw error;
  }

  const safeName = sanitizeFileToken(productName) || 'Neural-OS';
  const safeVersion = sanitizeFileToken(version) || '0.0.0';
  const safeArch = sanitizeFileToken(arch) || 'unknown';
  const dmgPath = path.join(dmgDir, `${safeName}_${safeVersion}_${safeArch}.dmg`);

  await fs.rm(dmgPath, { force: true });
  await execFileAsync(
    'hdiutil',
    ['create', '-volname', productName, '-srcfolder', stagingDir, '-ov', '-format', 'UDZO', dmgPath],
    { cwd: rootDir },
  );

  await fs.rm(stagingDir, { recursive: true, force: true });
  process.stdout.write(`[build-dmg-fallback] wrote ${path.relative(rootDir, dmgPath)}\n`);
}

createFallbackDmg().catch((error) => {
  console.error('[build-dmg-fallback] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
