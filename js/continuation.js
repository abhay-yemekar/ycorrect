/**
 * AI Continuation module — after the user pauses, suggest a continuation
 * shown as ghost text. Tab accepts, Escape dismisses.
 *
 * This is the "AI Text Cursor" feature that makes writing feel effortless.
 */

import { getEditor, setText } from './editor.js';
import { pushUndoState } from './shortcuts.js';

let ghostEl = null;
let debounceTimer = null;
let currentSuggestion = '';
let isActive = false;
let lastText = '';

const PAUSE_MS = 2000; // wait 2 seconds of no typing before suggesting
const MIN_CHARS = 20;  // need at least this many chars to suggest
const MAX_CONTEXT = 2000; // max context to send to AI

/**
 * Build the prompt for continuation.
 */
function buildContinuationPrompt(text) {
  // Send the last paragraph (or last MAX_CONTEXT chars)
  const lines = text.split('\n');
  const lastParagraph = lines[lines.length - 1] || '';
  const context = lastParagraph.length > MAX_CONTEXT
    ? lastParagraph.slice(-MAX_CONTEXT)
    : lastParagraph;

  return `You are WriteRight, a writing assistant. Continue the user's text naturally with 1-2 sentences. Do not repeat what they wrote. Do not add quotes, markdown, or explanation. Output ONLY the continuation text.\n\nText:\n${context}`;
}

/**
 * Fetch a continuation suggestion from the AI.
 */
async function fetchContinuation(text) {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: buildContinuationPrompt(text),
        mode: 'Standard',
        strength: 0.4,
        variant: 1,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    // The AI returns the continuation text — strip any leading whitespace
    return (data.text || '').replace(/^\s+/, '');
  } catch {
    return '';
  }
}

/**
 * Show the ghost text after the editor content.
 */
function showGhost(text) {
  if (!ghostEl) {
    ghostEl = document.createElement('div');
    ghostEl.className = 'ai-continuation';
  }

  const editor = getEditor();
  const editorRect = editor.getBoundingClientRect();

  // Position the ghost element after the editor text
  ghostEl.textContent = text;

  // Place it in the editor's scroll container
  const scrollContainer = editor.closest('.editor-scroll');
  if (scrollContainer) {
    // Remove existing ghost if any
    const existing = scrollContainer.querySelector('.ai-continuation');
    if (existing) existing.remove();

    // Create a positioned wrapper
    ghostEl.style.position = 'absolute';
    ghostEl.style.bottom = '8px';
    ghostEl.style.right = '16px';
    ghostEl.style.maxWidth = `${editorRect.width - 32}px`;
    ghostEl.style.fontSize = getComputedStyle(editor).fontSize;
    ghostEl.style.lineHeight = getComputedStyle(editor).lineHeight;
    scrollContainer.style.position = 'relative';
    scrollContainer.appendChild(ghostEl);
  }
}

/**
 * Hide the ghost text.
 */
function hideGhost() {
  if (ghostEl) {
    ghostEl.remove();
    ghostEl = null;
  }
  currentSuggestion = '';
}

/**
 * Request a continuation suggestion.
 */
async function requestContinuation() {
  const editor = getEditor();
  const text = editor.value;

  // Don't suggest for very short text
  if (text.trim().length < MIN_CHARS) return;

  // Don't suggest if the text hasn't changed since last suggestion
  if (text === lastText) return;

  isActive = true;
  const suggestion = await fetchContinuation(text);

  // Only show if the editor text hasn't changed while we were fetching
  if (editor.value !== text || !isActive) {
    isActive = false;
    return;
  }

  if (suggestion) {
    currentSuggestion = suggestion;
    showGhost(suggestion);
  }
  isActive = false;
}

/**
 * Accept the suggestion (Tab key).
 */
function acceptSuggestion() {
  if (!currentSuggestion) return;

  const editor = getEditor();
  pushUndoState('AI continuation');
  const text = editor.value;
  const cursorPos = editor.selectionStart;

  // Add the suggestion at the cursor position
  const newText = text.slice(0, cursorPos) + currentSuggestion + text.slice(cursorPos);
  setText(newText, cursorPos + currentSuggestion.length);

  hideGhost();
  lastText = editor.value;
}

/**
 * Initialize the continuation feature.
 */
export function initContinuation() {
  const editor = getEditor();
  if (!editor) return;

  // Listen for input — debounce before requesting
  editor.addEventListener('input', () => {
    const text = editor.value;

    // Hide ghost text on any input
    hideGhost();
    isActive = false;

    // Reset debounce
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Only suggest if text has grown (user typed, not deleted)
      if (text.length >= lastText.length && text.length >= MIN_CHARS) {
        requestContinuation();
      }
    }, PAUSE_MS);

    lastText = text;
  });

  // Tab accepts the suggestion
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && currentSuggestion && !e.ctrlKey && !e.metaKey) {
      // Only intercept if the ghost is visible
      if (ghostEl) {
        e.preventDefault();
        acceptSuggestion();
      }
    }

    // Escape dismisses
    if (e.key === 'Escape' && currentSuggestion) {
      hideGhost();
    }
  });

  // Hide ghost on focus loss
  editor.addEventListener('blur', () => {
    setTimeout(hideGhost, 200);
  });
}
