/**
 * Input validation helpers.
 *
 * All validation functions return null on success or an error response object.
 */

/**
 * Validate that a field exists and is a non-empty string.
 */
export function requireString(body, field, opts = {}) {
  const val = body[field];
  if (val === undefined || val === null) {
    return { status: 400, error: `Missing required field: ${field}` };
  }
  if (typeof val !== 'string') {
    return { status: 400, error: `Field "${field}" must be a string` };
  }
  if (opts.trim !== false && !val.trim()) {
    return { status: 400, error: `Field "${field}" cannot be empty` };
  }
  if (opts.maxLength && val.length > opts.maxLength) {
    return { status: 400, error: `Field "${field}" exceeds maximum length of ${opts.maxLength}` };
  }
  return null;
}

/**
 * Validate a field is one of the allowed values.
 */
export function requireEnum(body, field, allowed) {
  const val = body[field];
  if (val !== undefined && !allowed.includes(val)) {
    return { status: 400, error: `Field "${field}" must be one of: ${allowed.join(', ')}` };
  }
  return null;
}

/**
 * Validate that text is within a reasonable size limit.
 * Prevents sending huge payloads to the AI/grammar APIs.
 */
export function validateTextSize(text, maxChars = 50_000) {
  if (text && text.length > maxChars) {
    return { status: 413, error: `Text exceeds maximum size of ${maxChars.toLocaleString()} characters` };
  }
  return null;
}

/**
 * Sanitize text by removing null bytes and control characters (except newlines/tabs).
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
