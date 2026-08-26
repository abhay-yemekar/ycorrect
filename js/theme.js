/**
 * Theme module — dark mode with system preference detection.
 *
 * The inline script in <head> sets data-theme before first paint (defect 7),
 * reading the saved choice or the OS preference. This module syncs the
 * toggle button to that decision, persists ONLY explicit toggles (defect 8 —
 * persisting on load used to make the detected system theme look like a
 * user choice, which permanently disabled the system-preference listener),
 * and follows OS changes while the user hasn't chosen.
 */

import { $ } from './utils.js';

const STORAGE_KEY = 'ycorrectTheme';

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply a theme to the document (does not persist).
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  const btn = $('#themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

/**
 * Toggle between light and dark — the only place the choice is persisted.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
}

/**
 * Initialize the theme system.
 */
export function initTheme() {
  // The head script already decided; sync the toggle button to it.
  applyTheme(document.documentElement.getAttribute('data-theme') || systemTheme());

  const btn = $('#themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  // Follow OS-level changes while the user has not made an explicit choice.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Expose toggle for keyboard shortcut.
 */
export { toggleTheme };
