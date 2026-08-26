/**
 * yCorrect — main application entry point.
 *
 * Initializes all modules and wires up the editor input pipeline.
 */

import { $, setStatus } from './utils.js';
import { initEditor } from './editor.js';
import { runCheck, scheduleCheck, hidePopover, initGrammarPanel } from './grammar.js';
import { initAI, scheduleToneCheck, checkTone } from './ai.js';
import { updateStats } from './stats.js';
import { initSidebar } from './sidebar.js';
import { initTabs } from './tabs.js';
import { initTheme } from './theme.js';
import { initShortcuts } from './shortcuts.js';
import { initFindReplace } from './findReplace.js';
import { initDocSearch } from './search.js';
import { initExport } from './export.js';
import { initAccessibility } from './accessibility.js';
import { initLoadingStyles } from './loading.js';
import {
  getCurrentDoc, persistCurrent,
} from './documents.js';

// ─── Initialize all modules ───────────────────────────────────────

initLoadingStyles();
const editor = initEditor();
initGrammarPanel();
initAI();
initTabs();
initSidebar();
initTheme();
initShortcuts();
initFindReplace();
initDocSearch();
initExport();
initAccessibility();

// ─── Load initial document ────────────────────────────────────────

const currentDoc = getCurrentDoc();
const initial = currentDoc.text || '';
editor.value = initial;

// Update title
const titleEl = $('#title');
if (titleEl) titleEl.textContent = currentDoc.name;

// Update stats
updateStats(initial, 0);

// Run initial grammar check if there's content
if (initial.trim()) runCheck();

// ─── Editor input pipeline ────────────────────────────────────────

let saveTimer = null;

editor.addEventListener('input', () => {
  const text = editor.value;

  hidePopover();
  updateStats(text, 0);

  setStatus('Unsaved changes');

  // Debounced save
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistCurrent(text);
    setStatus('Saved locally');
  }, 500);

  // Debounced grammar check
  scheduleCheck();

  // Debounced tone check
  scheduleToneCheck();
});

// ─── Keyboard shortcuts ───────────────────────────────────────────

editor.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter: manual grammar check
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCheck();
    checkTone(true);
  }
});

// ─── Manual check button ──────────────────────────────────────────

const checkBtn = $('#check');
if (checkBtn) {
  checkBtn.addEventListener('click', () => {
    runCheck();
    checkTone(true);
  });
}

// ─── Close popover on outside click ───────────────────────────────

document.addEventListener('click', (e) => {
  if (
    !e.target.closest('#popover') &&
    !e.target.closest('.u') &&
    !e.target.closest('.issue')
  ) {
    hidePopover();
  }
});

// ─── Escape key closes popover ────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hidePopover();
});

// ─── File protocol warning ────────────────────────────────────────

if (location.protocol === 'file:') {
  const banner = $('#fileBanner');
  if (banner) banner.style.display = 'flex';
}

// ─── Scroll sync ──────────────────────────────────────────────────

editor.addEventListener('scroll', () => {
  const overlay = $('#overlay');
  if (overlay) overlay.scrollTop = editor.scrollTop;
});
