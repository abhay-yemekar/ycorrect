/**
 * POST /api/detect-ai
 *
 * AI detection score — estimates how likely text is AI-generated.
 * Uses Gemini to analyze writing patterns.
 */

import * as gemini from "../services/gemini.js";
import { requireString, validateTextSize, sanitizeText } from "../middleware/validate.js";

export default async function detectAiRoute(req, res, body) {
  const textError = requireString(body, "text", { maxLength: 10000 });
  if (textError) return textError;

  const text = sanitizeText(body.text);
  if (!text.trim()) {
    return { status: 400, error: "Text is required" };
  }

  const sizeError = validateTextSize(text, 10000);
  if (sizeError) return sizeError;

  const result = await gemini.detectAi(text);
  return result;
}
