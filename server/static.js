/**
 * Static file server with path traversal protection.
 *
 * Serves files from the project root with proper MIME types.
 * - Rejects any path that escapes the root directory (403).
 * - Rejects malformed percent-encoding with 400 (previously a 500).
 * - Never serves dotfiles (.env, .git/…) or node_modules (404) — the
 *   project root contains secrets that must not be reachable by URL.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function respondJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function createStaticServer(root) {
  return async function serveStatic(req, res) {
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      return respondJson(res, 400, { error: 'Malformed URL encoding' }), true;
    }

    if (pathname === '/') pathname = '/index.html';

    const filePath = path.join(root, pathname);
    const relative = path.relative(root, filePath);

    // Path traversal protection (checked before the dotfile rule so that
    // escapes are reported as 403 regardless of what they target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return respondJson(res, 403, { error: 'Forbidden' }), true;
    }

    // Never serve dotfiles (.env, .git/config, …) or dependency directories
    const segments = pathname.split('/').filter(Boolean);
    if (segments.some(s => s.startsWith('.') || s === 'node_modules')) {
      return respondJson(res, 404, { error: 'Not found' }), true;
    }

    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Cache static assets for 1 hour
      const cacheControl = ext === '.html'
        ? 'no-cache'
        : 'public, max-age=3600';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      });
      res.end(data);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return respondJson(res, 404, { error: 'Not found' }), true;
      }
      throw err;
    }
  };
}
