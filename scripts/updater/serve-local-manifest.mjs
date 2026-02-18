import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const channelDir = path.join(rootDir, '.updater', 'local-channel');
const port = Number(process.env.TAURI_UPDATER_LOCAL_PORT || 4545);

function contentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.sig')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const normalized = requestPath === '/' ? '/latest.json' : requestPath;
  const filePath = path.normalize(path.join(channelDir, normalized));

  if (!filePath.startsWith(channelDir)) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid path');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    res.writeHead(200, {
      'content-type': contentType(filePath),
      'cache-control': 'no-store',
    });
    res.end(content);
  });
});

server.listen(port, () => {
  process.stdout.write(`[updater] local channel serving ${channelDir} on http://127.0.0.1:${port}/latest.json\n`);
});
