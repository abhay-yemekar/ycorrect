/**
 * POST /api/summarize
 *
 * AI-powered text summarization with configurable style and length.
 */

import * as gemini from '../services/gemini.js';
import { validateTextSize, sanitizeText } from '../middleware/validate.js';

export default async function summarizeRoute(req, res, body) {
  const text = sanitizeText(body.text || '');

  if (!text.trim()) {
    return { status: 400, error: 'Text is required' };
  }

  const sizeError = validateTextSize(text, 50_000);
  if (sizeError) return sizeError;

  const style = body.style || 'paragraph';
  const length = body.length || 'medium';

  const result = await gemini.summarize(text, style, length);
  return { text: result };
}
