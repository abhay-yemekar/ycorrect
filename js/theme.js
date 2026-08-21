/**
 * Theme module — dark mode with system preference detection
 * and localStorage persistence.
 */

import { $ } from './utils.js';

const STORAGE_KEY = 'ycorrectTheme';

/**
 * Get the saved theme or detect system preference.
 */
function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to the document.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  // Update toggle button icon
  const btn = $('#themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

/**
 * Toggle between light and dark.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Initialize the theme system.
 */
export function initTheme() {
  // Apply saved/system theme immediately
  applyTheme(getSavedTheme());

  // Wire up toggle button
  const btn = $('#themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only auto-switch if user hasn't manually set a preference
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Expose toggle for keyboard shortcut.
 */
export { toggleTheme };
