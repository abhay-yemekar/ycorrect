/**
 * CORS middleware — configurable allowed origins.
 *
 * Set YCORRECT_CORS_ORIGIN in .env to a comma-separated list of origins
 * (e.g. "http://localhost:3000,https://example.com").
 * Defaults to "*" (same-origin only by browser policy).
 */

const allowedOrigins = (process.env.YCORRECT_CORS_ORIGIN || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

export default function cors(req, res) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true; // handled
  }
  return false; // not handled, continue
}
