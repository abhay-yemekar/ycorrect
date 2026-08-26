/**
 * yCorrect server — application wiring and entry point.
 *
 * Exports createServer() / startServer() so the full middleware + routes
 * stack can be booted on an ephemeral port by the test suite. When run
 * directly (`npm start` or `node server.js`), the server listens on PORT.
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─── Load .env ────────────────────────────────────────────────────
// Only fills variables that are not already present in the environment.

const root = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(root, '..');

try {
  const fs = await import('node:fs/promises');
  const env = await fs.readFile(path.join(projectRoot, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch {
  // .env is optional — AI features just won't work
}

// ─── Middleware ────────────────────────────────────────────────────

import cors from './middleware/cors.js';
import { apiLimiter, aiLimiter } from './middleware/rateLimit.js';
import securityHeaders from './middleware/security.js';
import logger from './middleware/logger.js';

// ─── Routes ───────────────────────────────────────────────────────

import grammarRoute from './routes/grammar.js';
import aiRoute from './routes/ai.js';
import summarizeRoute from './routes/summarize.js';
import toneRoute from './routes/tone.js';
import healthRoute from './routes/health.js';

// ─── Static files ─────────────────────────────────────────────────

import { createStaticServer } from './static.js';

// ─── Helpers ──────────────────────────────────────────────────────

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  try {
    return JSON.parse(data || '{}');
  } catch {
    return null;
  }
}

// ─── Route table ──────────────────────────────────────────────────

const POST_ROUTES = {
  '/api/grammar': { handler: grammarRoute, limiter: apiLimiter },
  '/api/ai':      { handler: aiRoute,      limiter: aiLimiter },
  '/api/summarize': { handler: summarizeRoute, limiter: aiLimiter },
  '/api/tone':    { handler: toneRoute,     limiter: aiLimiter },
};

const GET_ROUTES = {
  '/api/health': healthRoute,
};

// ─── Server factory ───────────────────────────────────────────────

export function createServer() {
  const serveStatic = createStaticServer(projectRoot);

  return http.createServer(async (req, res) => {
    try {
      // 1. Security headers (every response)
      securityHeaders(req, res);

      // 2. CORS (handles preflight)
      if (cors(req, res)) return;

      // 3. Logging (wraps res.end to capture timing)
      logger(req, res);

      // 4. POST API routes
      if (req.method === 'POST') {
        const route = POST_ROUTES[req.url];

        if (!route) {
          return sendJson(res, 404, { error: 'Not found' });
        }

        // Rate limiting
        if (route.limiter && route.limiter(req, res)) return;

        // Parse body
        const body = await readBody(req);
        if (body === null) {
          return sendJson(res, 400, { error: 'Invalid JSON' });
        }

        // Execute handler
        const result = await route.handler(req, res, body);

        // If handler returned an error status
        if (result?.status) {
          return sendJson(res, result.status, { error: result.error });
        }

        return sendJson(res, 200, result);
      }

      // 5. GET API routes
      if (req.method === 'GET') {
        const route = GET_ROUTES[req.url];
        if (route) {
          return sendJson(res, 200, route());
        }
      }

      // 6. Static files
      if (req.method === 'GET') {
        return await serveStatic(req, res);
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error(`[ERROR] ${req.method} ${req.url}:`, err);
      const status = err.status || 500;
      sendJson(res, status, { error: err.message || 'Internal server error' });
    }
  });
}

// ─── Start (only when run directly) ───────────────────────────────

export function startServer(port = Number(process.env.PORT || 3000)) {
  const server = createServer();

  function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });

    // Force exit after 5 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 5000);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  server.listen(port, '0.0.0.0', () => {
    const aiStatus = process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ No API key   ';
    const corsStatus = (process.env.YCORRECT_CORS_ORIGIN || '* (open)');
    console.log(`
  ┌──────────────────────────────────────────┐
  │           yCorrect server                │
  ├──────────────────────────────────────────┤
  │  Local:  http://localhost:${String(port).padEnd(5)}            │
  │  AI:     ${aiStatus}              │
  │  CORS:   ${corsStatus.padEnd(29)}│
  └──────────────────────────────────────────┘
  `);
    console.log(`yCorrect running at http://localhost:${port}`);
  });

  return server;
}

const isMain = Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startServer();
}
