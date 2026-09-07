/**
 * POST /api/compose
 *
 * Generative AI compose — writes text from a prompt.
 * Client sends a prompt and optional genre; server generates text via Gemini.
 */

import * as gemini from "../services/gemini.js";
import { requireString, sanitizeText } from "../middleware/validate.js";

export default async function composeRoute(req, res, body) {
  const promptError = requireString(body, "prompt", { maxLength: 2000 });
  if (promptError) return promptError;

  const prompt = sanitizeText(body.prompt);
  if (!prompt.trim()) {
    return { status: 400, error: "Prompt is required" };
  }

  const genre = body.genre || "General";
  const audience = body.audience || "General";

  const systemPrompt = "You are a professional writer. Write high-quality text based on the user prompt. Genre: " + genre + ". Audience: " + audience + ". Write naturally, with good structure and flow. Do not include the prompt in your response.";

  const result = await gemini.compose(prompt, systemPrompt, 0.7);
  return { text: result };
}
