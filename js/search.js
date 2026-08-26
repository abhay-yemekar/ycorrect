/**
 * Document search module.
 *
 * Searches across all saved documents and shows results in a dropdown.
 * Activated by Ctrl+Shift+F / Cmd+Shift+F.
 */

import { $, esc } from './utils.js';
import { getDocs, getCurrentId } from './documents.js';

let searchOverlay = null;

/**
 * Create the search overlay DOM.
 */
function createSearchOverlay() {
  if (searchOverlay) return searchOverlay;

  searchOverlay = document.createElement('div');
  searchOverlay.id = 'docSearch';
  searchOverlay.className = 'doc-search';
  searchOverlay.innerHTML = `
    <div class="doc-search-inner">
      <input type="text" id="docSearchInput" placeholder="Search across all documents…" class="doc-search-input" autocomplete="off">
      <div id="docSearchResults" class="doc-search-results"></div>
    </div>
  `;

  document.body.appendChild(searchOverlay);

  // Wire up events
  const input = $('#docSearchInput');
  input.addEventListener('input', performDocSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter') {
      const firstResult = $('.doc-search-result');
      if (firstResult) firstResult.click();
    }
  });

  // Close on backdrop click
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  return searchOverlay;
}

/**
 * Search across all documents.
 */
function performDocSearch() {
  const query = $('#docSearchInput').value.toLowerCase().trim();
  const resultsEl = $('#docSearchResults');

  if (!query) {
    resultsEl.innerHTML = '';
    return;
  }

  const docs = getDocs();
  const currentId = getCurrentId();
  const results = [];

  for (const doc of docs) {
    const text = (doc.text || '').toLowerCase();
    const name = (doc.name || '').toLowerCase();

    // Search in title and content
    if (name.includes(query) || text.includes(query)) {
      // Find the first matching snippet
      let snippet = '';
      if (text.includes(query)) {
        const idx = text.indexOf(query);
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + query.length + 50);
        snippet = (start > 0 ? '…' : '') +
          (doc.text || '').slice(start, end) +
          (end < text.length ? '…' : '');
      }

      results.push({
        doc,
        snippet,
        isCurrent: doc.id === currentId,
      });
    }
  }

  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="doc-search-empty">No documents found</div>';
    return;
  }

  resultsEl.innerHTML = results.map(r =>
    `<div class="doc-search-result ${r.isCurrent ? 'current' : ''}" data-id="${r.doc.id}">` +
      `<div class="doc-search-name">${esc(r.doc.name)}</div>` +
      (r.snippet
        ? `<div class="doc-search-snippet">${highlightMatch(r.snippet, query)}</div>`
        : '') +
      `<div class="doc-search-meta">${new Date(r.doc.updatedAt).toLocaleDateString()}</div>` +
    `</div>`
  ).join('');

  // Wire up result clicks
  resultsEl.querySelectorAll('.doc-search-result').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      // Switch to that document (we need to trigger the sidebar's openDoc)
      document.dispatchEvent(new CustomEvent('openDoc', { detail: { id } }));
      closeSearch();
    });
  });
}

/**
 * Highlight matching text in a snippet.
 */
function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return esc(text);
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return esc(before) + '<mark>' + esc(match) + '</mark>' + esc(after);
}

/**
 * Open the search overlay.
 */
function openSearch() {
  createSearchOverlay();
  searchOverlay.style.display = 'flex';
  const input = $('#docSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  $('#docSearchResults').innerHTML = '';
}

/**
 * Close the search overlay.
 */
function closeSearch() {
  if (searchOverlay) searchOverlay.style.display = 'none';
}

/**
 * Initialize document search with keyboard shortcut.
 */
export function initDocSearch() {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl/Cmd + Shift + F: Search across documents
    if (mod && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      if (searchOverlay && searchOverlay.style.display === 'flex') {
        closeSearch();
      } else {
        openSearch();
      }
    }
  });

  // Listen for openDoc events from search results
  document.addEventListener('openDoc', (e) => {
    const id = e.detail.id;
    // Trigger sidebar click
    const docEl = document.querySelector(`.doc[data-id="${id}"]`);
    if (docEl) docEl.click();
  });
}
