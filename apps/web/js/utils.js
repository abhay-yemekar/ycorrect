/**
 * Shared utilities — DOM helpers, escaping, notifications, and status bar.
 */

// ─── DOM shortcuts ────────────────────────────────────────────────

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// ─── HTML escaping ────────────────────────────────────────────────

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

// ─── Notifications ────────────────────────────────────────────────

let toastTimer = null;

export function notify(text) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ─── Status bar ───────────────────────────────────────────────────

export function setStatus(text) {
  const el = $('#saveState');
  if (el) el.textContent = text;
}

// ─── File download ───────────────────────────────────────────────

/**
 * Trigger a browser file download.
 */
export function download(filename, content, mimeType) {
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

/** Sanitize a string for use as a filename. */
export function sanitizeFilename(name) {
  return String(name).replace(/[<>:"/\\|?*]/g, '_').trim() || 'document';
}

// ─── Clipboard ─────────────────────────────────────────────────────────

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify('Copied to clipboard');
  } catch {
    notify('Could not copy — check browser permissions');
  }
}

// ─── Selected text helper ─────────────────────────────────────────

export function getSelectedText(editor) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  return start !== end ? editor.value.slice(start, end) : '';
}
