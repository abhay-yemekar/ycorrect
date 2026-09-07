/**
 * Stats module — word count, character count, reading time,
 * Flesch reading ease score, and issue count.
 */

import { $ } from './utils.js';

// ─── Flesch Reading Ease ──────────────────────────────────────────

/**
 * Flesch READING EASE (higher = easier; can go negative for very dense
 * text — we no longer clamp, which used to disguise hard text as
 * mid-range). Exported for tests.
 *
 * Syllables are counted as vowel-run groups — crude ("quiet" = 2,
 * "queue" = 1) but deterministic and dependency-free. Good enough for a
 * directional signal, not for grading (defect 23).
 */
export function fleschReadingEase(text) {
  const trimmed = text.trim();
  if (!trimmed) return '—';

  const words = trimmed.split(/\s+/).length;
  const sentences = (trimmed.match(/[.!?]+/g) || []).length || 1;
  const syllables = (trimmed.match(/[aeiouy]+/gi) || []).length;

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(score);
}

// ─── Update all stats ─────────────────────────────────────────────

/**
 * Update the word/char/read-time stats. #issueCount is intentionally NOT
 * touched here — it has exactly one writer, renderIssuesPanel() in
 * grammar.js, so the badge never flashes to 0 on every keystroke (defect 6).
 */
export function updateStats(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const wordEl = $('#wordCount');
  const charEl = $('#charCount');
  const readTimeEl = $('#readTime');
  const readEaseEl = $('#readEase');

  if (wordEl) wordEl.textContent = `${words} words`;
  if (charEl) charEl.textContent = `${text.length} chars`;
  if (readTimeEl) readTimeEl.textContent = `${words ? Math.max(1, Math.round(words / 200)) : 0} min read`;
  if (readEaseEl) readEaseEl.textContent = `Reading ease ${fleschReadingEase(text)}`;
}
