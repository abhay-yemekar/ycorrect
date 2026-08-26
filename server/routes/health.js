/**
 * GET /api/health
 *
 * Returns server status, uptime, and whether AI is configured.
 * Useful for the browser extension and monitoring.
 */

import { readFileSync } from 'node:fs';

import * as gemini from '../services/gemini.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

export default function healthRoute() {
  return {
    status: 'ok',
    version,
    uptime: Math.round(process.uptime()),
    ai: gemini.isConfigured() ? 'configured' : 'no API key',
    timestamp: new Date().toISOString(),
  };
}
