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
  // Allow inline styles/scripts (needed for the single-page app) but block
  // loading external resources unless they come from known CDNs.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://api.languagetool.org https://generativelanguage.googleapis.com",
  ].join('; '),
};

export default function securityHeaders(_req, res) {
  for (const [key, value] of Object.entries(HEADERS)) {
    res.setHeader(key, value);
  }
}
