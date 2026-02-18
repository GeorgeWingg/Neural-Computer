import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const releaseBundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle');
const localChannelDir = path.join(rootDir, '.updater', 'local-channel');
const manifestPath = path.join(localChannelDir, 'latest.json');

const fallbackEndpoint = process.env.TAURI_UPDATER_ENDPOINT || 'http://127.0.0.1:4545/latest.json';
const endpointBase = fallbackEndpoint.replace(/\/latest\.json$/, '').replace(/\/$/, '');

function mapPlatform(filename) {
  if (filename.includes('aarch64') || filename.includes('arm64')) return 'darwin-aarch64';
  if (filename.includes('x86_64') || filename.includes('x64')) return 'darwin-x86_64';
  return null;
}

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return walk(absolute);
      return absolute;
    }),
  );
  return files.flat();
}

async function copyFilePair(artifactPath, signaturePath) {
  const artifactName = path.basename(artifactPath);
  const signatureName = path.basename(signaturePath);
  await fs.copyFile(artifactPath, path.join(localChannelDir, artifactName));
  await fs.copyFile(signaturePath, path.join(localChannelDir, signatureName));
  return artifactName;
}

async function run() {
  await fs.mkdir(localChannelDir, { recursive: true });

  try {
    await fs.access(releaseBundleDir);
  } catch {
    throw new Error(
      `Release bundle directory not found at ${releaseBundleDir}. Run a release build first (for example: npm run tauri:build:release).`,
    );
  }

  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const version = String(packageJson.version || '0.0.0');

  const allFiles = await walk(releaseBundleDir);
  const signatureFiles = allFiles.filter((file) => file.endsWith('.sig'));

  if (!signatureFiles.length) {
    throw new Error(`No updater signature files found under ${releaseBundleDir}. Build with updater artifacts first.`);
  }

  const platforms = {};

  for (const signaturePath of signatureFiles) {
    const artifactPath = signaturePath.slice(0, -4);
    const platform = mapPlatform(path.basename(artifactPath));
    if (!platform) continue;

    const signature = (await fs.readFile(signaturePath, 'utf8')).trim();
    const copiedArtifactName = await copyFilePair(artifactPath, signaturePath);

    platforms[platform] = {
      signature,
      url: `${endpointBase}/${encodeURIComponent(copiedArtifactName)}`,
    };
  }

  if (!Object.keys(platforms).length) {
    throw new Error('No supported macOS updater artifacts were discovered.');
  }

  const manifest = {
    version,
    notes: 'Local updater channel generated for release-prep testing.',
    pub_date: new Date().toISOString(),
    platforms,
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`[updater] wrote ${path.relative(rootDir, manifestPath)}\n`);
}

run().catch((error) => {
  console.error('[updater] manifest generation failed', error);
  process.exit(1);
});
