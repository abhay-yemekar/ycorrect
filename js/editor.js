/**
 * Editor module — manages the textarea, transparent overlay for underlines,
 * scroll synchronization, and the single mutation path for programmatic
 * text changes.
 *
 * Invariant: the ONLY way to change editor text from code is setText() /
 * replaceAt() / setDocumentText(). Assigning editor.value directly fires no
 * input event, which used to leave the overlay, stats, and save state stale.
 */

import { $, esc } from './utils.js';

// ─── Issue classification ─────────────────────────────────────────

const RANK = { red: 3, blue: 2, yellow: 1 };

function classFor(issue) {
  const type = issue.rule?.issueType || '';
  const cat = issue.rule?.category?.name || '';
  if (type === 'misspelling' || type === 'grammar') return 'red';
  if (type === 'style' || cat === 'Clarity' || cat === 'Typography' || cat === 'Capitalization') return 'yellow';
  return 'blue';
}

// ─── State ────────────────────────────────────────────────────────

let editor, overlay;
let currentIssues = [];

// ─── Init ─────────────────────────────────────────────────────────

export function initEditor() {
  editor = $('#editor');
  overlay = $('#overlay');

  editor.addEventListener('scroll', () => {
    overlay.scrollTop = editor.scrollTop;
  });

  return editor;
}

export function getEditor() {
  return editor;
}

export function getOverlay() {
  return overlay;
}

// ─── Offset arithmetic ────────────────────────────────────────────

/**
 * Shift stored issue offsets to match a text change.
 *
 * Issues entirely before the edit keep their offset, issues entirely after
 * it shift by the length delta, and issues intersecting the edited region
 * are dropped (their range no longer refers to the same characters).
 *
 * Pure — unit-tested in Node.
 *
 * @param {object[]} issues
 * @param {string} prevText
 * @param {string} nextText
 * @returns {object[]} shifted issues
 */
export function shiftIssues(issues, prevText, nextText) {
  const minLen = Math.min(prevText.length, nextText.length);

  // Common prefix
  let start = 0;
  while (start < minLen && prevText[start] === nextText[start]) start++;

  // Common suffix
  let endPrev = prevText.length;
  let endNext = nextText.length;
  while (endPrev > start && endNext > start && prevText[endPrev - 1] === nextText[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  const delta = (endNext - start) - (endPrev - start);

  const shifted = [];
  for (const issue of issues) {
    const end = issue.offset + issue.length;
    if (end <= start) {
      shifted.push(issue); // entirely before the edit
    } else if (issue.offset >= endPrev) {
      shifted.push({ ...issue, offset: issue.offset + delta }); // entirely after
    }
    // else: intersects the edited region — drop
  }
  return shifted;
}

// ─── Mutation paths ───────────────────────────────────────────────

/**
 * The single mutation path for programmatic edits to the current document.
 * Shifts stored issues, re-renders the overlay, and dispatches a real
 * 'input' event so the normal pipeline (stats, save, check, tone) runs —
 * exactly as if the user had typed the change.
 *
 * @param {string} next
 * @param {number|null} [caret] — collapsed caret position after the edit
 */
export function setText(next, caret = null) {
  const prev = editor.value;
  if (prev === next) {
    if (caret !== null) editor.setSelectionRange(caret, caret);
    return;
  }

  editor.value = next;
  if (caret !== null) editor.setSelectionRange(caret, caret);

  currentIssues = shiftIssues(currentIssues, prev, next);
  renderOverlay();

  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Replace a range of text (used by grammar fixes).
 * The caret lands at the end of the inserted replacement.
 */
export function replaceAt(offset, length, replacement) {
  const text = editor.value;
  setText(
    text.slice(0, offset) + replacement + text.slice(offset + length),
    offset + replacement.length
  );
}

/**
 * Load a different document into the editor: clears stale issues and
 * re-renders, but does NOT fire the input pipeline — nothing was edited,
 * so the document must not be re-saved or re-checked by the caller's
 * debouncers. Callers run their own updateStats()/runCheck().
 */
export function setDocumentText(text) {
  editor.value = text;
  currentIssues = [];
  renderOverlay();
}

// ─── Overlay rendering ────────────────────────────────────────────

export function setIssues(issues) {
  currentIssues = issues;
  renderOverlay();
}

export function getIssues() {
  return currentIssues;
}

/**
 * Build the overlay HTML for a piece of text and its issues.
 *
 * Pure and DOM-free so the offset arithmetic is unit-testable in Node:
 * every issue is sliced into per-line segments, overlapping issues are
 * resolved by severity rank (red > blue > yellow), and all text is escaped.
 *
 * @param {string} plain — the exact editor text the offsets refer to
 * @param {object[]} issues — [{ offset, length, rule }]
 * @returns {string} HTML for #overlay
 */
export function renderOverlayHtml(plain, issues) {
  const lines = plain.split('\n');
  let html = '';
  let pos = 0;

  for (const line of lines) {
    const hits = issues
      .filter(i => i.offset < pos + line.length && i.offset + i.length > pos)
      .map(i => ({
        a: Math.max(i.offset, pos) - pos,
        b: Math.min(i.offset + i.length, pos + line.length) - pos,
        cls: classFor(i),
        idx: issues.indexOf(i),
      }))
      .sort((x, y) => x.a - y.a || y.b - x.b);

    const points = [...new Set([0, line.length, ...hits.flatMap(h => [h.a, h.b])])].sort((a, b) => a - b);

    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k];
      const b = points[k + 1];
      if (a >= b) continue;

      const segment = line.slice(a, b);
      let best = null;

      for (const h of hits) {
        if (h.a <= a && h.b >= b && (!best || RANK[h.cls] > RANK[best.cls])) {
          best = h;
        }
      }

      html += best
        ? `<span class="u u-${best.cls}" data-i="${best.idx}">${esc(segment)}</span>`
        : esc(segment);
    }

    html += '\n';
    pos += line.length + 1;
  }

  return html;
}

export function renderOverlay() {
  overlay.innerHTML = renderOverlayHtml(editor.value, currentIssues);
  overlay.scrollTop = editor.scrollTop;
}
