/**
 * POST /api/ai
 *
 * AI-powered text rewriting. The client sends the mode KEY (Standard,
 * Fluency, Formal, Academic, Simple, Creative, Expand, Shorten) plus a
 * 0–1 strength; prompt text and temperature are resolved server-side so
 * the request can never inject instructions (defect 13).
 */

import * as gemini from '../services/gemini.js';
import { PARA_MODES, MODE_KEYS, temperatureFor } from '../services/modes.js';
import { requireString, requireEnum, requireNumber, validateGoals, validateTextSize, sanitizeText } from '../middleware/validate.js';

export default async function aiRoute(req, res, body) {
  const textError = requireString(body, 'text', { maxLength: 30_000 });
  if (textError) return textError;

  const text = sanitizeText(body.text);
  if (!text.trim()) {
    return { status: 400, error: 'Text is required' };
  }

  const sizeError = validateTextSize(text, 30_000);
  if (sizeError) return sizeError;

  const modeError = requireEnum(body, 'mode', MODE_KEYS);
  if (modeError) return modeError;
  const modeKey = body.mode ?? 'Standard';

  const strengthError = requireNumber(body, 'strength', { min: 0, max: 1 });
  if (strengthError) return strengthError;
  const strength = body.strength ?? 0.5;

  const variantError = requireEnum(body, 'variant', [1, 2]);
  if (variantError) return variantError;
  const variant = body.variant ?? 1;

  const goalsError = validateGoals(body.goals);
  if (goalsError) return goalsError;

  const temperature = temperatureFor(modeKey, strength, variant);
  const result = await gemini.paraphrase(text, PARA_MODES[modeKey].prompt, temperature, body.goals || {});
  return { text: result };
}
