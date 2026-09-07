/**
 * Gemini AI service — proxy for Google's Generative Language API.
 *
 * Handles prompt construction, temperature clamping, and error normalization.
 * The API key never leaves this module.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Check if the Gemini API key is configured.
 */
export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Get the configured model name.
 */
function getModel() {
  // gemini-2.5-flash is the current recommended Flash model, but it is
  // scheduled for deprecation on 2026-10-16 (see the note in .env.example).
  // When it sunsets, update this fallback to the next recommended Flash model.
  // The server reads GEMINI_MODEL from .env at startup; this default only kicks
  // in when the env var is unset, so the project stays runnable out of the box.
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

/**
 * Throw a clear error if the API key is missing.
 */
function assertKey() {
  if (!isConfigured()) {
    const err = new Error(
      'AI tools need a Gemini API key. Add GEMINI_API_KEY to your .env file.\n' +
      'Get a free key at https://aistudio.google.com/app/apikey'
    );
    err.status = 503;
    throw err;
  }
}

/**
 * Core generation call.
 *
 * @param {string} prompt
 * @param {number} [temperature=0.5]
 * @param {boolean} [json=false] — request JSON response format
 * @returns {Promise<string>}
 */
export async function generate(prompt, temperature = 0.5, json = false) {
  assertKey();

  const model = getModel();
  const genConfig = { temperature: Math.min(1, Math.max(0, temperature)) };
  if (json) genConfig.responseMimeType = 'application/json';

  // The key travels in a header, never the query string — URLs land in
  // proxy logs, crash reports, and error messages (defect 12).
  const response = await fetch(`${BASE_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: genConfig,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `Gemini returned ${response.status}`;
    const err = new Error(msg);
    err.status = response.status >= 500 ? 502 : response.status;
    throw err;
  }

  const text = (data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text;
}

// ─── High-level helpers ───────────────────────────────────────────

/**
 * Build a goals context line for prompts.
 */
function goalsLine(goals) {
  const g = goals || {};
  return `Audience: ${g.audience || 'General'}. Formality: ${g.formality || 'Neutral'}. Genre: ${g.genre || 'General'}.`;
}

/**
 * Paraphrase / rewrite text.
 */
export async function paraphrase(text, mode, temperature, goals) {
  const prompt =
    `You are WriteRight, a precise writing assistant. ${goalsLine(goals)} ` +
    `Return only the improved text, with no quotes, preamble, markdown, or explanation. ` +
    `Task: ${mode}. Preserve the user meaning and do not invent facts.\n\nText:\n${text}`;
  return generate(prompt, temperature);
}

/**
 * Summarize text.
 */
const SUMMARIZE_STYLE = {
  sentences: 'Return the 3-5 most important sentences of the text, one per line, no numbering or extra words.',
  bullets: 'Return a bulleted summary using "- " prefixes with 3-6 concise bullets.',
  paragraph: 'Return a single paragraph summary.',
};

const SUMMARIZE_LENGTH = {
  short: 'Keep it brief.',
  medium: 'Moderate length.',
  long: 'More detailed.',
};

export async function summarize(text, style, length) {
  const prompt =
    `You are WriteRight. Summarize the following text. ` +
    `${SUMMARIZE_STYLE[style] || SUMMARIZE_STYLE.paragraph} ` +
    `${SUMMARIZE_LENGTH[length] || ''} Preserve the key facts. Do not invent information. Output only the summary.\n\nText:\n${text}`;
  return generate(prompt, 0.3);
}

/**
 * Detect tone and formality.
 */
export async function detectTone(text) {
  const prompt =
    `Analyze the writing tone of this text. Respond only with JSON in this exact shape: ` +
    `{"tone": "one or two words, e.g. Professional, Friendly, Persuasive", ` +
    `"formality": "Formal, Neutral or Casual", ` +
    `"confidence": integer 0-100}\n\nText:\n${text}`;

  const raw = await generate(prompt, 0.2, true);

  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
  } catch {
    return { tone: 'Neutral', formality: 'Neutral', confidence: 0 };
  }
}

/**
 * Compose text from a prompt.
 */
export async function compose(prompt, systemPrompt, temperature) {
  const fullPrompt = systemPrompt + String.fromCharCode(10,10) + "User request: " + prompt;
  return generate(fullPrompt, temperature);
}

/**
 * Detect AI-generated text.
 */
export async function detectAi(text) {
  const prompt = "Analyze this text and estimate the probability it was written by AI. Respond ONLY with JSON: {score: integer 0-100, confidence: integer 0-100, reason: brief explanation} Text: " + text;
  const raw = await generate(prompt, 0.2, true);
  try {
    return JSON.parse(raw.replace(/[`]{3}(?:json)?s*/g, "").trim());
  } catch {
    return { score: 0, confidence: 0, reason: "Could not analyze" };
  }
}

/**
 * Generate a citation.
 */
export async function cite(source, style) {
  const prompt = "Generate a " + style + " citation for this source. Source: " + source + " Return ONLY the formatted citation, no explanation.";
  return generate(prompt, 0.2);
}

/**
 * Translate text.
 */
export async function translate(text, targetLanguage) {
  const prompt = "Translate the following text to " + targetLanguage + ". Return ONLY the translated text, no quotes or explanation. Text: " + text;
  return generate(prompt, 0.3);
}

/**
 * Enhance vocabulary — suggest stronger word choices.
 */
export async function vocabularyEnhance(text) {
  const prompt = "Analyze this text and suggest stronger word choices for weak or overused words. Respond ONLY with JSON: {suggestions: [{word: string, replacement: string, reason: string}]} Text: " + text;
  const raw = await generate(prompt, 0.3, true);
  try {
    return JSON.parse(raw.replace(/`{3}(?:json)?s*|`{3}s*/g, "").trim());
  } catch {
    return { suggestions: [] };
  }
}
