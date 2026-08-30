/**
 * POST /api/vocabulary
 *
 * Vocabulary enhancement — suggests stronger word choices.
 */

import * as gemini from "../services/gemini.js";
import { requireString, validateTextSize, sanitizeText } from "../middleware/validate.js";

export default async function vocabularyRoute(req, res, body) {
  const textError = requireString(body, "text", { maxLength: 5000 });
  if (textError) return textError;

  const text = sanitizeText(body.text);
  if (!text.trim()) {
    return { status: 400, error: "Text is required" };
  }

  const sizeError = validateTextSize(text, 5000);
  if (sizeError) return sizeError;

  const result = await gemini.vocabularyEnhance(text);
  return result;
}