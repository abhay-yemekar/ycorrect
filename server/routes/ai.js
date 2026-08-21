/**
 * POST /api/ai
 *
 * AI-powered text rewriting. Supports multiple modes:
 * Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten.
 */

import * as gemini from '../services/gemini.js';
import { validateTextSize, sanitizeText } from '../middleware/validate.js';

const DEFAULT_MODE = 'Paraphrase this text naturally, keeping the same meaning and length.';

export default async function aiRoute(req, res, body) {
  const text = sanitizeText(body.text || '');

  if (!text.trim()) {
    return { status: 400, error: 'Text is required' };
  }

  const sizeError = validateTextSize(text, 30_000);
  if (sizeError) return sizeError;

  const mode = body.mode || DEFAULT_MODE;
  const temperature = body.temperature ?? 0.5;
  const goals = body.goals || {};

  const result = await gemini.paraphrase(text, mode, temperature, goals);
  return { text: result };
}
