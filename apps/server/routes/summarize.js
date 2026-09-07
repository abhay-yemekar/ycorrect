/**
 * POST /api/summarize
 *
 * AI-powered text summarization with validated style and length.
 */

import * as gemini from '../services/gemini.js';
import { requireString, requireEnum, validateTextSize, sanitizeText } from '../middleware/validate.js';

const STYLES = ['sentences', 'bullets', 'paragraph'];
const LENGTHS = ['short', 'medium', 'long'];

export default async function summarizeRoute(req, res, body) {
  const textError = requireString(body, 'text', { maxLength: 50_000 });
  if (textError) return textError;

  const text = sanitizeText(body.text);
  if (!text.trim()) {
    return { status: 400, error: 'Text is required' };
  }

  const sizeError = validateTextSize(text, 50_000);
  if (sizeError) return sizeError;

  const styleError = requireEnum(body, 'style', STYLES);
  if (styleError) return styleError;

  const lengthError = requireEnum(body, 'length', LENGTHS);
  if (lengthError) return lengthError;

  const style = body.style ?? 'paragraph';
  const length = body.length ?? 'medium';

  const result = await gemini.summarize(text, style, length);
  return { text: result };
}
