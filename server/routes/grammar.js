/**
 * POST /api/grammar
 *
 * Combines local pattern-based rules with LanguageTool remote checks.
 * Deduplicates results by offset+length+message.
 */

import { checkGrammar } from '../services/languagetool.js';
import { checkLocal } from '../services/localRules.js';
import { validateTextSize, sanitizeText } from '../middleware/validate.js';

/**
 * Merge local and remote matches: dedupe by offset+length+message, then
 * sort in reading order (by offset, longer match first at equal offsets)
 * so the issues panel lists problems the way the user wrote them.
 * @param {object[]} localMatches
 * @param {object[]} remoteMatches
 * @returns {object[]}
 */
export function mergeMatches(localMatches, remoteMatches) {
  const seen = new Set();
  return [...localMatches, ...remoteMatches]
    .filter(m => {
      const key = `${m.offset}:${m.length}:${m.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.offset - b.offset || b.length - a.length);
}

export default async function grammarRoute(req, res, body) {
  const text = sanitizeText(body.text || '');

  if (!text.trim()) {
    return { matches: [] };
  }

  const sizeError = validateTextSize(text, 50_000);
  if (sizeError) return sizeError;

  // Run local and remote checks in parallel
  const [localMatches, remoteMatches] = await Promise.all([
    Promise.resolve(checkLocal(text)),
    checkGrammar(text).catch(err => {
      console.error('LanguageTool error:', err.message);
      return []; // Graceful degradation — local rules still work
    }),
  ]);

  // Merge, dedupe, and order for the issues panel
  return { matches: mergeMatches(localMatches, remoteMatches) };
}
