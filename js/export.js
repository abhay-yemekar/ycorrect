/**
 * Export module — download the current document in various formats.
 *
 * Supports: Plain Text (.txt), Markdown (.md), HTML (.html).
 */

import { notify } from './utils.js';
import { getEditor } from './editor.js';
import { getCurrentDoc } from './documents.js';

/**
 * Trigger a file download in the browser.
 */
function download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a filename (remove special characters).
 */
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document';
}

/**
 * Export as plain text.
 */
function exportTxt() {
  const editor = getEditor();
  const doc = getCurrentDoc();
  const filename = sanitizeFilename(doc.name) + '.txt';
  download(filename, editor.value, 'text/plain;charset=utf-8');
  notify(`Exported as ${filename}`);
}

/**
 * Export as Markdown.
 */
function exportMd() {
  const editor = getEditor();
  const doc = getCurrentDoc();
  const filename = sanitizeFilename(doc.name) + '.md';
  download(filename, editor.value, 'text/markdown;charset=utf-8');
  notify(`Exported as ${filename}`);
}

/**
 * Export as HTML with basic styling.
 */
function exportHtml() {
  const editor = getEditor();
  const doc = getCurrentDoc();
  const filename = sanitizeFilename(doc.name) + '.html';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${doc.name}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; line-height: 1.75; color: #1b2228; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #0f766e; padding-bottom: 0.5rem; }
    .meta { color: #66737c; font-size: 0.85rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>${doc.name}</h1>
  <div class="meta">Exported from yCorrect · ${new Date().toLocaleDateString()}</div>
  <pre style="white-space: pre-wrap; font-family: inherit;">${editor.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;

  download(filename, html, 'text/html;charset=utf-8');
  notify(`Exported as ${filename}`);
}

/**
 * Initialize export buttons.
 * Expected HTML: buttons with data-export="txt|md|html"
 */
export function initExport() {
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.export;
      if (format === 'txt') exportTxt();
      else if (format === 'md') exportMd();
      else if (format === 'html') exportHtml();
    });
  });
}
