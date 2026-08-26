/**
 * Zero-dependency in-memory rate limiter.
 *
 * Tracks request counts per IP using a fixed-window counter.
 * Old entries are pruned periodically to keep memory bounded.
 *
 * Each limiter instance owns its counters: the 120/min general API budget
 * and the 20/min AI budget are independent (they previously shared one map,
 * so grammar traffic could exhaust the AI budget).
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = Number(process.env.YCORRECT_RATE_LIMIT || 120);
const CLEANUP_INTERVAL = 300_000; // prune every 5 min

/**
 * Returns a middleware function.
 * @param {object} opts
 * @param {number} [opts.max]  — max requests per window (default: env or 120)
 * @param {number} [opts.windowMs] — window duration in ms (default: 60 000)
 * @param {string} [opts.message] — error message when limited
 */
export function createRateLimiter(opts = {}) {
  const max = opts.max ?? MAX_REQUESTS;
  const windowMs = opts.windowMs ?? WINDOW_MS;
  const message = opts.message || 'Too many requests. Please slow down.';

  const hits = new Map(); // ip → { count, resetAt } — per limiter instance

  // Periodic cleanup to prevent memory leak from abandoned IPs.
  // unref'd so tests and short-lived processes can exit cleanly.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of hits) {
      if (now > data.resetAt) hits.delete(ip);
    }
  }, CLEANUP_INTERVAL);
  if (typeof cleanup.unref === 'function') cleanup.unref();

  return function rateLimit(req, res) {
    const ip = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      hits.set(ip, entry);
      return false; // allowed
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      });
      res.end(JSON.stringify({ error: message, retryAfter }));
      return true; // blocked
    }

    return false; // allowed
  };
}

// Pre-built limiters for different endpoint types
export const apiLimiter = createRateLimiter({ max: 120, windowMs: 60_000 });
export const aiLimiter = createRateLimiter({ max: 20, windowMs: 60_000, message: 'AI request limit reached. Please wait a moment.' });
