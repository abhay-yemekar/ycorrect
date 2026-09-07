/**
 * Lightweight structured request logger.
 *
 * Outputs method, URL, status, and response time in ms.
 * Skips logging for static asset requests in production to reduce noise.
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function colorize(status, text) {
  if (status >= 500) return `${COLORS.red}${text}${COLORS.reset}`;
  if (status >= 400) return `${COLORS.yellow}${text}${COLORS.reset}`;
  if (status >= 300) return `${COLORS.cyan}${text}${COLORS.reset}`;
  return `${COLORS.green}${text}${COLORS.reset}`;
}

// Static file extensions to skip logging (to reduce noise)
const STATIC_EXTS = new Set(['.css', '.js', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2']);

function isStaticRequest(url) {
  const ext = url.split('?')[0].match(/\.[^.]+$/)?.[0];
  return ext && STATIC_EXTS.has(ext);
}

export default function logger(req, res) {
  const start = Date.now();
  const skip = isStaticRequest(req.url);

  // Monkey-patch end to capture status and timing
  const originalEnd = res.end;
  res.end = function (...args) {
    const ms = Date.now() - start;
    const status = res.statusCode;

    if (!skip || status >= 400) {
      const statusStr = colorize(status, String(status));
      const method = req.method.padEnd(6);
      const timeStr = ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
      const dim = COLORS.dim;
      const reset = COLORS.reset;
      console.log(`${dim}${new Date().toISOString().slice(11, 23)}${reset} ${method} ${req.url} ${statusStr} ${dim}${timeStr}${reset}`);
    }

    return originalEnd.apply(this, args);
  };
}
