/**
 * Sidebar module — renders the document list and handles switching,
 * creating, renaming, and deleting documents.
 */

import { $, notify } from './utils.js';
import {
  getDocs, getCurrentId, switchTo, createDoc, renameDoc, deleteDoc, persistCurrent,
} from './documents.js';
import { getEditor, setDocumentText } from './editor.js';
import { runCheck } from './grammar.js';
import { updateStats } from './stats.js';
import { hidePopover } from './grammar.js';

// ─── Render document list ─────────────────────────────────────────

function renderDocs() {
  const list = $('#docList');
  if (!list) return;

  const sorted = getDocs().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const currentId = getCurrentId();

  list.innerHTML = sorted.map(d =>
    `<div class="doc ${d.id === currentId ? 'active' : ''}" data-id="${d.id}">` +
      `<div class="doc-main">` +
        `<div class="doc-name">${escapeHtml(d.name)}</div>` +
        `<div class="doc-meta">${new Date(d.updatedAt).toLocaleDateString()}</div>` +
      `</div>` +
      `<button class="doc-del" data-id="${d.id}">×</button>` +
    `</div>`
  ).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}

// ─── Open document ────────────────────────────────────────────────

function openDoc(id) {
  const editor = getEditor();
  persistCurrent(editor.value);

  const doc = switchTo(id);
  const text = doc.text || '';
  setDocumentText(text);

  hidePopover();
  updateStats(text);
  renderDocs();

  const saveState = $('#saveState');
  if (saveState) saveState.textContent = 'Saved locally';

  if (text.trim()) {
    runCheck();
  }
}

// ─── New document ─────────────────────────────────────────────────

function handleNewDoc(promptUser = true) {
  const editor = getEditor();

  if (promptUser && editor.value.trim() && !confirm('Start a new document?')) return;

  createDoc();
  setDocumentText('');
  hidePopover();
  updateStats('');
  renderDocs();

  const saveState = $('#saveState');
  if (saveState) saveState.textContent = 'Saved locally';

  notify('New document created');
}

// ─── Rename ───────────────────────────────────────────────────────

function handleRename() {
  const docs = getDocs();
  const currentId = getCurrentId();
  const doc = docs.find(d => d.id === currentId);
  if (!doc) return;

  const name = prompt('Document name', doc.name);
  if (!name) return;

  renameDoc(doc.id, name);

  const titleEl = $('#title');
  if (titleEl) titleEl.textContent = name;

  renderDocs();
}

// ─── Init ─────────────────────────────────────────────────────────

export function initSidebar() {
  const newBtn = $('#newDoc');
  const newBtn2 = $('#newDoc2');
  const renameBtn = $('#rename');
  const list = $('#docList');

  if (newBtn) newBtn.addEventListener('click', () => handleNewDoc(true));
  if (newBtn2) newBtn2.addEventListener('click', () => handleNewDoc(true));
  if (renameBtn) renameBtn.addEventListener('click', handleRename);

  if (list) {
    list.addEventListener('click', (e) => {
      const del = e.target.closest('.doc-del');
      if (del) {
        if (!confirm('Delete this document?')) return;
        deleteDoc(del.dataset.id);
        renderDocs();
        // Reload the current doc into the editor
        const doc = getDocs().find(d => d.id === getCurrentId());
        const editor = getEditor();
        if (doc && editor) {
          setDocumentText(doc.text || '');
          updateStats(editor.value);
          runCheck();
        }
        return;
      }

      const el = e.target.closest('.doc');
      if (el) openDoc(el.dataset.id);
    });
  }

  renderDocs();
}
