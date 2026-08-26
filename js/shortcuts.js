/**
 * Keyboard shortcuts module.
 *
 * Provides:
 * - Ctrl/Cmd + Z: undo last AI action
 * - Ctrl/Cmd + Shift + Z: redo last undone AI action
 * - Ctrl/Cmd + S: manual save
 * - Ctrl/Cmd + Shift + D: toggle dark mode
 * - Ctrl/Cmd + Enter: grammar check (handled in app.js)
 */

import { notify } from './utils.js';
import { getEditor } from './editor.js';
import { persistCurrent } from './documents.js';
import { runCheck } from './grammar.js';
import { toggleTheme } from './theme.js';

// ─── Undo/Redo stack ──────────────────────────────────────────────

/**
 * The undo/redo stack tracks editor text states.
 * Each entry is { text, description }.
 *
 * This is separate from the browser's built-in undo (which handles
 * native typing) — it specifically tracks AI replacements and bulk edits.
 */

const MAX_HISTORY = 50;

let undoStack = [];
let redoStack = [];

/**
 * Push the current state onto the undo stack before an AI action.
 */
export function pushUndoState(description = 'AI action') {
  const editor = getEditor();
  if (!editor) return;

  undoStack.push({
    text: editor.value,
    description,
    cursor: editor.selectionStart,
  });

  // Trim old entries
  if (undoStack.length > MAX_HISTORY) {
    undoStack = undoStack.slice(-MAX_HISTORY);
  }

  // Clear redo stack on new action
  redoStack = [];
}

/**
 * Undo: restore the previous state.
 */
function undo() {
  if (undoStack.length === 0) {
    notify('Nothing to undo');
    return;
  }

  const editor = getEditor();
  if (!editor) return;

  // Save current state to redo stack
  redoStack.push({
    text: editor.value,
    description: 'undo',
    cursor: editor.selectionStart,
  });

  // Restore previous state
  const state = undoStack.pop();
  editor.value = state.text;
  editor.setSelectionRange(state.cursor, state.cursor);

  notify(`Undone: ${state.description}`);
  persistCurrent(state.text);
  runCheck();
}

/**
 * Redo: re-apply the last undone action.
 */
function redo() {
  if (redoStack.length === 0) {
    notify('Nothing to redo');
    return;
  }

  const editor = getEditor();
  if (!editor) return;

  // Save current state to undo stack
  undoStack.push({
    text: editor.value,
    description: 'redo',
    cursor: editor.selectionStart,
  });

  // Restore redo state
  const state = redoStack.pop();
  editor.value = state.text;
  editor.setSelectionRange(state.cursor, state.cursor);

  notify('Redone');
  persistCurrent(state.text);
  runCheck();
}

// ─── Manual save ──────────────────────────────────────────────────

function manualSave() {
  const editor = getEditor();
  if (!editor) return;

  persistCurrent(editor.value);
  notify('Document saved');
}

// ─── Init ─────────────────────────────────────────────────────────

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (!mod) return;

    // Ctrl/Cmd + Z: Undo AI action
    if (e.key === 'z' && !e.shiftKey) {
      // Only intercept if there are AI undo states
      // (let native undo handle normal typing)
      if (undoStack.length > 0) {
        e.preventDefault();
        undo();
      }
    }

    // Ctrl/Cmd + Shift + Z: Redo
    if (e.key === 'z' && e.shiftKey) {
      if (redoStack.length > 0) {
        e.preventDefault();
        redo();
      }
    }

    // Ctrl/Cmd + Y: Redo (alternative)
    if (e.key === 'y') {
      if (redoStack.length > 0) {
        e.preventDefault();
        redo();
      }
    }

    // Ctrl/Cmd + S: Manual save
    if (e.key === 's') {
      e.preventDefault();
      manualSave();
    }

    // Ctrl/Cmd + Shift + D: Toggle dark mode
    if (e.key === 'd' && e.shiftKey) {
      e.preventDefault();
      toggleTheme();
    }
  });
}
