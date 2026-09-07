/**
 * Sentence Rewrite module — click a sentence in the issues panel or use a
 * keyboard shortcut to rewrite individual sentences with AI alternatives.
 *
 * Shows 2-3 AI-generated alternatives in a popup with Replace/Copy/Dismiss.
 */

import { esc, notify } from './utils.js';
import { getEditor, setText } from './editor.js';
import { pushUndoState } from './shortcuts.js';

let rewritePopup = null;

/**
 * Find the sentence boundaries around a given offset in text.
 */
function findSentence(text, offset) {
  // Walk backward to find sentence start
  let start = offset;
  while (start > 0 && !'.!?\n'.includes(text[start - 1])) start--;
  // Skip leading whitespace
  while (start < text.length && ' \t'.includes(text[start])) start++;

  // Walk forward to find sentence end
  let end = offset;
  while (end < text.length && !'.!?\n'.includes(text[end])) end++;
  if (end < text.length) end++; // include the punctuation

  return { sentence: text.slice(start, end).trim(), start, end };
}

/**
 * Fetch multiple rewrite alternatives for a sentence.
 */
async function fetchAlternatives(sentence, mode) {
  const promises = [1, 2, 3].map(variant =>
    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sentence, mode, strength: 0.5, variant }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => data?.text || '')
      .catch(() => '')
  );

  const results = await Promise.all(promises);
  // Deduplicate and filter empty
  const seen = new Set();
  return results.filter(t => {
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * Show the rewrite popup with alternatives.
 */
function showRewritePopup(original, alternatives, mode, range) {
  hideRewritePopup();

  rewritePopup = document.createElement('div');
  rewritePopup.className = 'sentence-rewrite-popup';

  let html = `<div class="sr-header">`;
  html += `<span class="sr-mode">${esc(mode)}</span>`;
  html += `<button class="sr-close" data-action="dismiss">&times;</button>`;
  html += `</div>`;

  html += `<div class="sr-original"><span class="sr-label">Original</span>${esc(original)}</div>`;

  for (let i = 0; i < alternatives.length; i++) {
    html += `<div class="sr-alt">`;
    html += `<span class="sr-label">Alternative ${i + 1}</span>`;
    html += `<div class="sr-text">${esc(alternatives[i])}</div>`;
    html += `<div class="sr-actions">`;
    html += `<button class="btn primary small" data-action="replace" data-text="${esc(alternatives[i])}">Replace</button>`;
    html += `<button class="btn ghost small" data-action="copy" data-text="${esc(alternatives[i])}">Copy</button>`;
    html += `</div></div>`;
  }

  if (!alternatives.length) {
    html += `<div class="sr-empty">No alternatives generated</div>`;
  }

  rewritePopup.innerHTML = html;

  // Position it in the right panel area
  const panel = document.querySelector('.panel');
  if (panel) {
    panel.appendChild(rewritePopup);
  } else {
    document.body.appendChild(rewritePopup);
  }

  // Event handling
  rewritePopup.addEventListener('click', (e) => {
    const action = e.target.dataset?.action;
    if (action === 'replace') {
      const text = e.target.dataset.text;
      if (text) {
        pushUndoState('Sentence rewrite');
        const editor = getEditor();
        const current = editor.value;
        setText(
          current.slice(0, range.start) + text + current.slice(range.end),
          range.start + text.length
        );
        hideRewritePopup();
        notify('Sentence replaced');
      }
    } else if (action === 'copy') {
      const text = e.target.dataset.text;
      if (text) {
        navigator.clipboard?.writeText(text);
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
      }
    } else if (action === 'dismiss') {
      hideRewritePopup();
    }
  });
}

function hideRewritePopup() {
  if (rewritePopup) {
    rewritePopup.remove();
    rewritePopup = null;
  }
}

/**
 * Initialize the sentence rewrite feature.
 * Activated by the "Rewrite" button in the issues panel or toolbar.
 */
export function initSentenceRewrite() {
  // Global handler for rewrite buttons
  document.addEventListener('click', async (e) => {
    const rewriteBtn = e.target.closest('[data-sentence-rewrite]');
    if (!rewriteBtn) return;

    e.preventDefault();
    const mode = rewriteBtn.dataset.mode || 'Fluency';
    const offset = parseInt(rewriteBtn.dataset.offset, 10);
    const length = parseInt(rewriteBtn.dataset.length, 10);

    if (isNaN(offset) || isNaN(length)) return;

    const editor = getEditor();
    const text = editor.value;
    const { sentence, start, end } = findSentence(text, offset);

    if (!sentence) return;

    rewriteBtn.textContent = '⏳';
    rewriteBtn.disabled = true;

    try {
      const alternatives = await fetchAlternatives(sentence, mode);
      showRewritePopup(sentence, alternatives, mode, { start, end });
    } catch {
      notify('Rewrite failed — try again');
    } finally {
      rewriteBtn.textContent = '✦';
      rewriteBtn.disabled = false;
    }
  });

  // Escape closes the popup
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rewritePopup) {
      hideRewritePopup();
    }
  });
}
