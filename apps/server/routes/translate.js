/**
 * POST /api/translate
 *
 * Translation endpoint — translates text using Gemini.
 */

import * as gemini from "../services/gemini.js";
import { requireString, sanitizeText } from "../middleware/validate.js";

const LANGUAGES = ["Spanish","French","German","Portuguese","Italian","Japanese","Chinese","Korean","Arabic","Hindi","Russian","Dutch","Swedish","Polish","Turkish","Thai","Vietnamese","Indonesian","English"];

export default async function translateRoute(req, res, body) {
  const textError = requireString(body, "text", { maxLength: 10000 });
  if (textError) return textError;

  const text = sanitizeText(body.text);
  if (!text.trim()) {
    return { status: 400, error: "Text is required" };
  }

  const target = body.targetLanguage || "Spanish";
  if (!LANGUAGES.includes(target)) {
    return { status: 400, error: "Target language must be one of: " + LANGUAGES.join(", ") };
  }

  const result = await gemini.translate(text, target);
  return { translation: result, targetLanguage: target };
}