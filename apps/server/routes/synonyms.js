/**
 * GET /api/synonyms?word=hello
 *
 * Proxies the free DataMuse API (no key required) to provide synonyms,
 * antonyms, and definitions for a word. Used by both the web editor
 * (double-click) and the Chrome extension.
 */

import { sanitizeText } from '../middleware/validate.js';

const DATAMUSE_URL = 'https://api.datamuse.com/words';

/**
 * Fetch words from DataMuse with the given parameters.
 * @param {Record<string,string>} params
 * @returns {Promise<object[]>}
 */
async function fetchFromDataMuse(params) {
  const url = new URL(DATAMUSE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    throw new Error(`DataMuse returned ${res.status}`);
  }

  return res.json();
}

/**
 * Main handler — called from server/app.js for GET /api/synonyms.
 * Returns { synonyms, antonyms, definitions } for the queried word.
 */
export default async function synonymsRoute(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const raw = url.searchParams.get('word') || '';
  const word = sanitizeText(raw).trim().toLowerCase();

  if (!word || word.length > 50 || !/^[a-z'-]+$/.test(word)) {
    return { synonyms: [], antonyms: [], definitions: [] };
  }

  // Fire all three DataMuse queries in parallel
  const [synResults, antResults, defResults] = await Promise.all([
    fetchFromDataMuse({ rel_syn: word, max: '8' }).catch(() => []),
    fetchFromDataMuse({ rel_ant: word, max: '5' }).catch(() => []),
    fetchFromDataMuse({ md: 'd', max: '3', sp: word }).catch(() => []),
  ]);

  const synonyms = synResults.map(w => w.word).filter(Boolean);
  const antonyms = antResults.map(w => w.word).filter(Boolean);
  const definitions = defResults
    .map(w => w.defs?.[0] || '')
    .filter(Boolean)
    .map(d => {
      // DataMuse returns "pos\tdefinition" — split on first tab
      const [pos, ...rest] = d.split('\t');
      return { pos, definition: rest.join('\t') };
    });

  return { word, synonyms, antonyms, definitions };
}
