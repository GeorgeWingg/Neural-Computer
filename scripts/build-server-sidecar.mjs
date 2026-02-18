import { build } from 'esbuild';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tmpDir = path.join(rootDir, '.tmp', 'sidecar');
const binariesDir = path.join(rootDir, 'src-tauri', 'binaries');
const sidecarDir = path.join(rootDir, 'src-tauri', 'sidecar');
const bundledServerPath = path.join(sidecarDir, 'server.bundle.cjs');
const nodeVersion = process.env.SIDECAR_NODE_VERSION || '20.20.0';

const targets = [
  {
    triple: 'aarch64-apple-darwin',
    distArch: 'arm64',
    output: path.join(binariesDir, 'neural-os-node-aarch64-apple-darwin'),
  },
  {
    triple: 'x86_64-apple-darwin',
    distArch: 'x64',
    output: path.join(binariesDir, 'neural-os-node-x86_64-apple-darwin'),
  },
];

async function ensureExecutable(filePath) {
  await fs.chmod(filePath, 0o755);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadNodeBinary(target) {
  if (await fileExists(target.output)) {
    await ensureExecutable(target.output);
    return;
  }

  const archiveName = `node-v${nodeVersion}-darwin-${target.distArch}.tar.gz`;
  const archivePath = path.join(tmpDir, archiveName);
  const extractRoot = path.join(tmpDir, `node-v${nodeVersion}-darwin-${target.distArch}`);
  const archiveUrl = `https://nodejs.org/dist/v${nodeVersion}/${archiveName}`;

  await fs.mkdir(tmpDir, { recursive: true });

  const downloadArchive = async () => {
    process.stdout.write(`[build-server-sidecar] downloading ${archiveUrl}\n`);
    await execFileAsync(
      'curl',
      ['-fL', '--retry', '3', '--retry-all-errors', '-o', archivePath, archiveUrl],
      { cwd: rootDir },
    );
  };

  if (!(await fileExists(archivePath))) {
    await downloadArchive();
  }

  let extracted = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.rm(extractRoot, { recursive: true, force: true });
      await execFileAsync('tar', ['-xzf', archivePath, '-C', tmpDir], { cwd: rootDir });
      extracted = true;
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      await fs.rm(archivePath, { force: true });
      await downloadArchive();
    }
  }

  if (!extracted) {
    throw new Error(`Failed to extract ${archiveName}`);
  }

  const extractedNode = path.join(extractRoot, 'bin', 'node');
  await fs.copyFile(extractedNode, target.output);
  await ensureExecutable(target.output);
  process.stdout.write(`[build-server-sidecar] prepared ${path.relative(rootDir, target.output)}\n`);
}

async function run() {
  await fs.mkdir(sidecarDir, { recursive: true });
  await fs.mkdir(binariesDir, { recursive: true });

  // Clean legacy pkg-era binaries so only the embedded-node sidecars remain.
  await Promise.all([
    fs.rm(path.join(sidecarDir, 'server.bundle.mjs'), { force: true }),
    fs.rm(path.join(binariesDir, 'neural-computer-server-aarch64-apple-darwin'), { force: true }),
    fs.rm(path.join(binariesDir, 'neural-computer-server-x86_64-apple-darwin'), { force: true }),
    fs.rm(path.join(binariesDir, 'neural-computer-node-aarch64-apple-darwin'), { force: true }),
    fs.rm(path.join(binariesDir, 'neural-computer-node-x86_64-apple-darwin'), { force: true }),
  ]);

  await build({
    entryPoints: [path.join(rootDir, 'server.mjs')],
    outfile: bundledServerPath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    legalComments: 'none',
  });

  for (const target of targets) {
    await downloadNodeBinary(target);
  }

  process.stdout.write(`[build-server-sidecar] wrote ${path.relative(rootDir, bundledServerPath)}\n`);
}

run().catch((error) => {
  console.error('[build-server-sidecar] failed', error);
  process.exit(1);
});
