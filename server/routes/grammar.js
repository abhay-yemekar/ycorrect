/**
 * POST /api/grammar
 *
 * Combines local pattern-based rules with LanguageTool remote checks.
 * Deduplicates results by offset+length+message.
 */

import { checkGrammar } from '../services/languagetool.js';
import { checkLocal } from '../services/localRules.js';
import { joinParagraphs, splitMatches } from '../services/paragraphs.js';
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

const MAX_PARAGRAPHS = 200;
const MAX_PARAGRAPH_CHARS = 20_000;

export default async function grammarRoute(req, res, body) {
  // Batched per-paragraph checks (Phase 4): the client sends only the
  // paragraphs it cannot serve from cache. They are joined into ONE
  // LanguageTool request and split back by offset — the public API
  // rate-limits per IP, so one request per paragraph would trip 429s.
  if (Array.isArray(body.paragraphs)) {
    const paragraphs = body.paragraphs;
    if (paragraphs.length > MAX_PARAGRAPHS) {
      return { status: 400, error: `Too many paragraphs (max ${MAX_PARAGRAPHS})` };
    }
    for (const p of paragraphs) {
      if (typeof p !== 'string') {
        return { status: 400, error: 'Every paragraph must be a string' };
      }
    }

    const clean = paragraphs.map(p => sanitizeText(p).slice(0, MAX_PARAGRAPH_CHARS));
    if (clean.reduce((n, p) => n + p.length, 0) > 50_000) {
      return { status: 413, error: 'Combined text exceeds maximum size' };
    }

    const layout = joinParagraphs(clean);
    const [localMatches, remoteMatches] = await Promise.all([
      Promise.resolve(checkLocal(layout.text)),
      layout.text.trim()
        ? checkGrammar(layout.text).catch(err => {
            console.error('LanguageTool error:', err.message);
            return []; // Graceful degradation — local rules still work
          })
        : Promise.resolve([]),
    ]);

    return { paragraphMatches: splitMatches(mergeMatches(localMatches, remoteMatches), layout) };
  }

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
