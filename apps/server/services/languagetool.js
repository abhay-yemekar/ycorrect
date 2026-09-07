/**
 * LanguageTool service — grammar and spelling checks via the public API.
 *
 * Chunks large texts to stay within the API's size limits and merges
 * results back with correct offsets.
 */

const API_URL = 'https://api.languagetool.org/v2/check';
const CHUNK_SIZE = 15_000;

/**
 * Check a single chunk of text against the LanguageTool API.
 * @param {string} part  — text chunk
 * @param {number} start — character offset of this chunk in the full text
 * @returns {Promise<object[]>} matches with adjusted offsets
 */
async function checkChunk(part, start) {
  const params = new URLSearchParams({
    text: part,
    language: 'en-US',
    enabledOnly: 'false',
  });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`LanguageTool returned ${response.status}`);
  }

  const data = await response.json();
  return (data.matches || []).map(m => ({ ...m, offset: m.offset + start }));
}

/**
 * Check text for grammar issues.
 * Splits large texts into chunks and runs them in parallel.
 *
 * @param {string} text
 * @returns {Promise<object[]>} deduplicated matches
 */
export async function checkGrammar(text) {
  const chunks = [];

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(checkChunk(text.slice(i, i + CHUNK_SIZE), i));
  }

  const results = await Promise.all(chunks);
  return results.flat();
}
