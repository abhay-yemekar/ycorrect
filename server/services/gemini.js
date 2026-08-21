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

  const response = await fetch(`${BASE_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    `You are yCorrect, a precise writing assistant. ${goalsLine(goals)} ` +
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
    `You are yCorrect. Summarize the following text. ` +
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
