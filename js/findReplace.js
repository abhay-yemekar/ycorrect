/**
 * Find & Replace module.
 *
 * Provides a floating search bar with:
 * - Find (Ctrl+F / Cmd+F)
 * - Replace (Ctrl+H / Cmd+H)
 * - Match count
 * - Next/Previous navigation
 * - Replace / Replace All
 */

import { $, notify } from './utils.js';
import { getEditor } from './editor.js';
import { persistCurrent } from './documents.js';
import { runCheck } from './grammar.js';

let findBar = null;
let matches = [];
let currentMatchIndex = -1;

/**
 * Create the find & replace bar DOM.
 */
function createFindBar() {
  if (findBar) return findBar;

  findBar = document.createElement('div');
  findBar.id = 'findBar';
  findBar.className = 'find-bar';
  findBar.innerHTML = `
    <div class="find-row">
      <input type="text" id="findInput" placeholder="Find…" class="find-input" autocomplete="off">
      <span id="findCount" class="find-count"></span>
      <button id="findPrev" class="find-btn" title="Previous (Shift+Enter)">↑</button>
      <button id="findNext" class="find-btn" title="Next (Enter)">↓</button>
      <button id="findClose" class="find-btn find-close" title="Close (Escape)">×</button>
    </div>
    <div class="find-row find-replace-row" id="replaceRow" style="display:none">
      <input type="text" id="replaceInput" placeholder="Replace…" class="find-input" autocomplete="off">
      <button id="replaceOne" class="find-btn find-replace-btn" title="Replace">Replace</button>
      <button id="replaceAll" class="find-btn find-replace-btn" title="Replace All">All</button>
    </div>
  `;

  // Insert after the editor card
  const editorCard = document.querySelector('.editor-card');
  if (editorCard) {
    editorCard.parentElement.insertBefore(findBar, editorCard.nextSibling);
  }

  // Wire up events
  const findInput = $('#findInput');
  const replaceInput = $('#replaceInput');

  findInput.addEventListener('input', performSearch);
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrev();
      else findNext();
    }
    if (e.key === 'Escape') closeFindBar();
  });

  if (replaceInput) {
    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        replaceOne();
      }
      if (e.key === 'Escape') closeFindBar();
    });
  }

  $('#findNext').addEventListener('click', findNext);
  $('#findPrev').addEventListener('click', findPrev);
  $('#findClose').addEventListener('click', closeFindBar);
  $('#replaceOne').addEventListener('click', replaceOne);
  $('#replaceAll').addEventListener('click', replaceAll);

  return findBar;
}

/**
 * Search for matches in the editor text.
 */
function performSearch() {
  const query = $('#findInput').value;
  const editor = getEditor();
  const text = editor.value;
  const countEl = $('#findCount');

  if (!query) {
    matches = [];
    currentMatchIndex = -1;
    countEl.textContent = '';
    return;
  }

  // Find all occurrences (case-insensitive)
  matches = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let idx = 0;

  while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
    matches.push({ start: idx, end: idx + query.length });
    idx++;
  }

  currentMatchIndex = matches.length > 0 ? 0 : -1;
  countEl.textContent = matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0 results';

  if (matches.length > 0) {
    highlightMatch(0);
  }
}

/**
 * Highlight and scroll to a match.
 */
function highlightMatch(index) {
  const editor = getEditor();
  const match = matches[index];
  if (!match) return;

  editor.focus();
  editor.setSelectionRange(match.start, match.end);

  const countEl = $('#findCount');
  if (countEl) countEl.textContent = `${index + 1}/${matches.length}`;
}

/**
 * Navigate to the next match.
 */
function findNext() {
  if (matches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % matches.length;
  highlightMatch(currentMatchIndex);
}

/**
 * Navigate to the previous match.
 */
function findPrev() {
  if (matches.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
  highlightMatch(currentMatchIndex);
}

/**
 * Replace the current match.
 */
function replaceOne() {
  if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;

  const editor = getEditor();
  const replaceText = $('#replaceInput').value;
  const match = matches[currentMatchIndex];

  const text = editor.value;
  editor.value = text.slice(0, match.start) + replaceText + text.slice(match.end);
  editor.setSelectionRange(match.start, match.start + replaceText.length);

  persistCurrent(editor.value);
  performSearch();
  runCheck();
  notify('Replaced 1 occurrence');
}

/**
 * Replace all matches.
 */
function replaceAll() {
  const replaceText = $('#replaceInput').value;

  if (!replaceText || matches.length === 0) return;

  const editor = getEditor();
  const text = editor.value;
  const count = matches.length;

  // Replace from end to start to preserve offsets
  let newText = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    newText = newText.slice(0, m.start) + replaceText + newText.slice(m.end);
  }

  editor.value = newText;
  persistCurrent(newText);
  performSearch();
  runCheck();
  notify(`Replaced ${count} occurrences`);
}

/**
 * Open the find bar.
 */
function openFindBar(replaceMode = false) {
  createFindBar();
  findBar.style.display = 'block';

  const replaceRow = $('#replaceRow');
  if (replaceRow) replaceRow.style.display = replaceMode ? 'flex' : 'none';

  const findInput = $('#findInput');
  if (findInput) {
    // Pre-fill with selected text
    const editor = getEditor();
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (selected && !selected.includes('\n')) {
      findInput.value = selected;
    }
    findInput.focus();
    findInput.select();
    performSearch();
  }
}

/**
 * Close the find bar.
 */
function closeFindBar() {
  if (findBar) findBar.style.display = 'none';
  matches = [];
  currentMatchIndex = -1;
  const editor = getEditor();
  if (editor) editor.focus();
}

/**
 * Toggle the find bar.
 */
function toggleFindBar(replaceMode = false) {
  if (findBar && findBar.style.display === 'block') {
    closeFindBar();
  } else {
    openFindBar(replaceMode);
  }
}

/**
 * Initialize find & replace with keyboard shortcuts.
 */
export function initFindReplace() {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (!mod) return;

    // Ctrl/Cmd + F: Find
    if (e.key === 'f' && !e.shiftKey) {
      e.preventDefault();
      toggleFindBar(false);
    }

    // Ctrl/Cmd + H: Find & Replace
    if (e.key === 'h') {
      e.preventDefault();
      toggleFindBar(true);
    }
  });
}
