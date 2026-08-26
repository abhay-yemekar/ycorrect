/**
 * Stats module — word count, character count, reading time,
 * Flesch reading ease score, and issue count.
 */

import { $ } from './utils.js';

// ─── Flesch Reading Ease ──────────────────────────────────────────

/**
 * Flesch Reading Ease (0–100, higher = easier). Exported for tests.
 */
export function fleschReadingEase(text) {
  const trimmed = text.trim();
  if (!trimmed) return '—';

  const words = trimmed.split(/\s+/).length;
  const sentences = (trimmed.match(/[.!?]+/g) || []).length || 1;
  const syllables = (trimmed.match(/[aeiouy]+/gi) || []).length;

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Update all stats ─────────────────────────────────────────────

export function updateStats(text, issueCount) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const wordEl = $('#wordCount');
  const charEl = $('#charCount');
  const readTimeEl = $('#readTime');
  const fkEl = $('#fkScore');
  const issueEl = $('#issueCount');

  if (wordEl) wordEl.textContent = `${words} words`;
  if (charEl) charEl.textContent = `${text.length} chars`;
  if (readTimeEl) readTimeEl.textContent = `${words ? Math.max(1, Math.round(words / 200)) : 0} min read`;
  if (fkEl) fkEl.textContent = `FK ${fleschReadingEase(text)}`;
  if (issueEl) issueEl.textContent = issueCount;
}
