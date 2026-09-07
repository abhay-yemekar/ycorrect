/**
 * Security headers middleware.
 *
 * Adds hardened headers to every response without any external dependencies.
 * These mirror what `helmet` would provide, tailored for a local dev tool.
 */

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Tightened to what the app actually uses (defect 17):
  // - exactly one inline script is allowed: the pre-paint theme bootstrap
  //   in index.html, by SHA-256 hash. test/server.test.js recomputes the
  //   hash from index.html and fails if the two drift apart — if you edit
  //   that script, update the hash here.
  // - no inline styles: all styling lives in styles.css
  // - no web fonts, and the browser never calls LanguageTool/Gemini
  //   (the server proxies both), so no external connect/font origins.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'sha256-BjVcMAWX5HhhswZ8TBbu27SNBgJZqEHX0MfCaCKgvvk='",
    "style-src 'self'",
    "img-src 'self'",
  ].join('; '),
};

export default function securityHeaders(_req, res) {
  for (const [key, value] of Object.entries(HEADERS)) {
    res.setHeader(key, value);
  }
}
