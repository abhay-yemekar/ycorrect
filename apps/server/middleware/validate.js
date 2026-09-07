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
 * Validate a field is a finite number within [min, max].
 * The field is optional — undefined/null passes (use defaults at call site).
 */
export function requireNumber(body, field, { min, max } = {}) {
  const val = body[field];
  if (val === undefined || val === null) return null;
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return { status: 400, error: `Field "${field}" must be a number` };
  }
  if (min !== undefined && val < min) {
    return { status: 400, error: `Field "${field}" must be >= ${min}` };
  }
  if (max !== undefined && val > max) {
    return { status: 400, error: `Field "${field}" must be <= ${max}` };
  }
  return null;
}

/**
 * Validate the writing-goals shape: an optional object whose values are
 * short strings. Rejects non-objects and non-string values so goals can
 * never smuggle structured content into prompts.
 */
const GOAL_KEYS = ['audience', 'formality', 'genre'];
const GOAL_MAX_LEN = 100;

export function validateGoals(goals) {
  if (goals === undefined || goals === null) return null;
  if (typeof goals !== 'object' || Array.isArray(goals)) {
    return { status: 400, error: 'Field "goals" must be an object' };
  }
  for (const [key, value] of Object.entries(goals)) {
    if (!GOAL_KEYS.includes(key)) {
      return { status: 400, error: `Unknown goal: "${key}"` };
    }
    if (typeof value !== 'string' || value.length > GOAL_MAX_LEN) {
      return { status: 400, error: `Goal "${key}" must be a string of at most ${GOAL_MAX_LEN} characters` };
    }
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
