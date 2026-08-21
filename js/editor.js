/**
 * Editor module — manages the textarea, transparent overlay for underlines,
 * and scroll synchronization.
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

  overlay.addEventListener('click', (e) => {
    const span = e.target.closest('.u');
    if (!span) return;
    const idx = +span.dataset.i;
    const issue = currentIssues[idx];
    if (!issue) return;

    editor.focus();
    editor.setSelectionRange(issue.offset, issue.offset + issue.length);

    // Dispatch a custom event for the grammar module to handle
    const rect = span.getBoundingClientRect();
    editor.dispatchEvent(new CustomEvent('issueClick', {
      detail: { issue, index: idx, rect },
    }));
  });

  return editor;
}

export function getEditor() {
  return editor;
}

// ─── Overlay rendering ────────────────────────────────────────────

export function setIssues(issues) {
  currentIssues = issues;
  renderOverlay();
}

export function renderOverlay() {
  const plain = editor.value;
  const lines = plain.split('\n');
  let html = '';
  let pos = 0;

  for (const line of lines) {
    const hits = currentIssues
      .filter(i => i.offset < pos + line.length && i.offset + i.length > pos)
      .map(i => ({
        a: Math.max(i.offset, pos) - pos,
        b: Math.min(i.offset + i.length, pos + line.length) - pos,
        cls: classFor(i),
        idx: currentIssues.indexOf(i),
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

  overlay.innerHTML = html;
  overlay.scrollTop = editor.scrollTop;
}

// ─── Replace text at offset ───────────────────────────────────────

export function replaceAt(offset, length, replacement) {
  const text = editor.value;
  const before = text.slice(0, offset);
  const after = text.slice(offset + length);
  editor.value = before + replacement + after;
  editor.setSelectionRange(offset, offset + replacement.length);
}
