/**
 * POST /api/tone
 *
 * Detects writing tone and formality level using Gemini.
 * Sends at most 6000 chars to keep the call fast.
 */

import * as gemini from '../services/gemini.js';
import { sanitizeText } from '../middleware/validate.js';

export default async function toneRoute(req, res, body) {
  const text = sanitizeText(body.text || '');

  if (!text.trim()) {
    return { tone: 'Neutral', formality: 'Neutral', confidence: 0 };
  }

  const truncated = text.slice(0, 6000);
  return gemini.detectTone(truncated);
}
