/**
 * GET /api/health
 *
 * Returns server status, uptime, and whether AI is configured.
 * Useful for the browser extension and monitoring.
 */

import * as gemini from '../services/gemini.js';

export default function healthRoute() {
  return {
    status: 'ok',
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
    ai: gemini.isConfigured() ? 'configured' : 'no API key',
    timestamp: new Date().toISOString(),
  };
}
