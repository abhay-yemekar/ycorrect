/**
 * Paraphrase modes — the server-side vocabulary.
 *
 * Clients send the mode KEY; prompt text and temperature bands live here so
 * a caller can never inject instructions into the prompt (defect 13).
 * Creative and Expand get a hotter band (defect 5 — the old client-side
 * check tested a substring of the prompt text and never fired).
 */

const STANDARD_BAND = [0.15, 0.65];
const CREATIVE_BAND = [0.5, 0.95];

export const PARA_MODES = {
  Standard: { prompt: 'Paraphrase this text naturally, keeping the same meaning and length.', temp: STANDARD_BAND },
  Fluency:  { prompt: 'Rewrite this text for fluent, natural English; fix awkward phrasing while preserving meaning.', temp: STANDARD_BAND },
  Formal:   { prompt: 'Rewrite this text in formal, professional English.', temp: STANDARD_BAND },
  Academic: { prompt: 'Rewrite this text in academic style with precise vocabulary and a formal structure.', temp: STANDARD_BAND },
  Simple:   { prompt: 'Rewrite this text in plain, simple English that anyone can understand.', temp: STANDARD_BAND },
  Creative: { prompt: 'Rewrite this text in a creative, vivid, engaging style.', temp: CREATIVE_BAND },
  Expand:   { prompt: 'Expand this text with more detail and depth while keeping the same meaning.', temp: CREATIVE_BAND },
  Shorten:  { prompt: 'Shorten this text, keeping only the essential meaning in fewer words.', temp: STANDARD_BAND },
};

export const MODE_KEYS = Object.keys(PARA_MODES);

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Temperature for a mode at a given strength (0–1).
 * Variant 2 runs slightly hotter so the two suggestions differ.
 * Pure — unit-tested.
 */
export function temperatureFor(modeKey, strength, variant = 1) {
  const [min, max] = PARA_MODES[modeKey].temp;
  const base = min + (max - min) * clamp01(strength);
  return variant === 2 ? Math.min(1, base + 0.15) : base;
}
