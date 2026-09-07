/**
 * Synonyms module — double-click a word to see synonyms, antonyms, and definitions.
 *
 * Uses the server's /api/synonyms endpoint which proxies the free DataMuse API.
 * Shows a floating card with word alternatives that can be clicked to replace.
 */

import { esc, notify } from './utils.js';
import { getEditor, setText } from './editor.js';
import { pushUndoState } from './shortcuts.js';

let cardEl = null;
const hideTimer = null;

/**
 * Get the word at a given position in text.
 */
function wordAt(text, pos) {
  // Walk left and right to find word boundaries
  let start = pos;
  while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
  let end = pos;
  while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;
  return { word: text.slice(start, end), start, end };
}

/**
 * Fetch synonyms from the server.
 */
async function fetchSynonyms(word) {
  try {
    const res = await fetch(`/api/synonyms?word=${encodeURIComponent(word)}`);
    if (!res.ok) return { synonyms: [], antonyms: [], definitions: [] };
    return await res.json();
  } catch {
    return { synonyms: [], antonyms: [], definitions: [] };
  }
}

/**
 * Build the synonym card HTML.
 */
function buildCardHtml(word, data) {
  const parts = [];

  if (data.definitions?.length) {
    const defs = data.definitions
      .map(d => `<span class="syn-def"><em>${esc(d.pos)}</em> ${esc(d.definition)}</span>`)
      .join('');
    parts.push(`<div class="syn-section"><span class="syn-label">Definitions</span>${defs}</div>`);
  }

  if (data.synonyms?.length) {
    const syns = data.synonyms
      .map(s => `<button class="syn-word" data-word="${esc(s)}">${esc(s)}</button>`)
      .join('');
    parts.push(`<div class="syn-section"><span class="syn-label">Synonyms</span><div class="syn-words">${syns}</div></div>`);
  }

  if (data.antonyms?.length) {
    const ants = data.antonyms
      .map(a => `<button class="syn-word ant" data-word="${esc(a)}">${esc(a)}</button>`)
      .join('');
    parts.push(`<div class="syn-section"><span class="syn-label">Antonyms</span><div class="syn-words">${ants}</div></div>`);
  }

  if (!parts.length) {
    return `<div class="syn-empty">No synonyms found for "${esc(word)}"</div>`;
  }

  return `<div class="syn-header">✦ ${esc(word)}</div>${parts.join('')}`;
}

/**
 * Show the synonym card near the double-clicked word.
 */
function showCard(word, rect, editor, wordRange) {
  hideCard();
  clearTimeout(hideTimer);

  cardEl = document.createElement('div');
  cardEl.className = 'syn-card';
  cardEl.innerHTML = `<div class="syn-loading">Loading synonyms…</div>`;
  cardEl.style.top = `${rect.bottom + 6}px`;
  cardEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 320))}px`;
  document.body.appendChild(cardEl);

  // Handle clicks on synonym words
  cardEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.syn-word');
    if (!btn) return;
    const replacement = btn.dataset.word;
    if (!replacement) return;

    pushUndoState('Synonym replacement');
    const text = editor.value;
    setText(
      text.slice(0, wordRange.start) + replacement + text.slice(wordRange.end),
      wordRange.start + replacement.length
    );
    hideCard();
    notify(`Replaced with "${replacement}"`);
  });

  // Close on outside click
  const closeHandler = (e) => {
    if (cardEl && !cardEl.contains(e.target)) {
      hideCard();
      document.removeEventListener('click', closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler, true), 50);

  // Fetch synonyms
  fetchSynonyms(word).then(data => {
    if (cardEl) {
      cardEl.innerHTML = buildCardHtml(word, data);
    }
  });
}

/**
 * Hide the synonym card.
 */
function hideCard() {
  if (cardEl) {
    cardEl.remove();
    cardEl = null;
  }
}

/**
 * Initialize the double-click synonym feature.
 */
export function initSynonyms() {
  const editor = getEditor();
  if (!editor) return;

  editor.addEventListener('dblclick', () => {
    const text = editor.value;
    const pos = editor.selectionStart;
    if (pos < 0 || pos >= text.length) return;

    const { word, start, end } = wordAt(text, pos);
    if (!word || word.length < 2) return;

    // Calculate screen position of the word
    // We use a trick: temporarily select the word to get its bounding rect
    const prevStart = editor.selectionStart;
    const prevEnd = editor.selectionEnd;
    editor.setSelectionRange(start, end);

    // Use a range to get the rect — works for textarea via a mirror technique
    // For simplicity, position relative to the editor
    const editorRect = editor.getBoundingClientRect();
    const charWidth = editorRect.width / (editor.cols || 40);
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;

    // Approximate position
    const linesBefore = text.slice(0, start).split('\n');
    const line = linesBefore.length - 1;
    const col = linesBefore[line]?.length || 0;

    const top = editorRect.top + line * lineHeight - editor.scrollTop;
    const left = editorRect.left + col * charWidth;

    // Restore selection
    editor.setSelectionRange(prevStart, prevEnd);

    showCard(word, { top, left, bottom: top + lineHeight, right: left + 100 }, editor, { start, end });
  });
}
