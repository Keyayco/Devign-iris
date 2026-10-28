// Minimal dependency-free static file server for Devign Iris.
// Usage: node serve.mjs   (PORT env var optional, default 8000)
// Native ES modules do not load from file:// URLs, so the app must be served over HTTP.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8000;
const HOST = '0.0.0.0';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
// Only the app itself is served; docs, tests, and config stay private to the repo.
const PUBLIC_PREFIXES = ['index.html', 'css/', 'js/'];

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const rel = normalize(urlPath).replace(/^[/\\]+/, '');
    const abs = join(ROOT, rel);
    if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');
    if (!PUBLIC_PREFIXES.some((p) => rel === p || rel.startsWith(p))) return send(res, 404, 'Not found');
    const info = await stat(abs);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(abs);
    res.writeHead(200, { 'Content-Type': TYPES[extname(abs)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    const missing = err && err.code === 'ENOENT';
    send(res, missing ? 404 : 500, missing ? 'Not found' : 'Server error');
  }
});

function send(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

server.listen(PORT, HOST, () => console.log(`Devign Iris serving on http://${HOST}:${PORT}`));
