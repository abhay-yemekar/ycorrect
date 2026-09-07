/**
 * Accessibility module.
 *
 * Provides:
 * - ARIA live region for dynamic announcements
 * - Focus management for modals and popovers
 * - Keyboard navigation improvements
 * - Reduced motion support
 */

import { $ } from './utils.js';

/**
 * Create an ARIA live region for screen reader announcements.
 * Styled by #a11yLive rules in styles.css (CSP forbids inline styles).
 */
function createLiveRegion() {
  const region = document.createElement('div');
  region.id = 'a11yLive';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

let liveRegion = null;

/**
 * Announce a message to screen readers.
 */
export function announce(message) {
  if (!liveRegion) liveRegion = createLiveRegion();
  liveRegion.textContent = '';
  // Small delay so the screen reader detects the change
  requestAnimationFrame(() => {
    liveRegion.textContent = message;
  });
}

/**
 * Trap focus within a container element.
 * Returns a cleanup function to restore focus.
 */
export function trapFocus(container) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (focusable.length === 0) return () => {};

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const previousFocus = document.activeElement;

  function handler(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', handler);
  first.focus();

  return () => {
    container.removeEventListener('keydown', handler);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  };
}

/**
 * Check if the user prefers reduced motion.
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Add skip-to-content link for keyboard users.
 * Styled by .skip-link rules in styles.css; the :focus rule reveals it.
 */
function addSkipLink() {
  const link = document.createElement('a');
  link.href = '#editor';
  link.className = 'skip-link';
  link.textContent = 'Skip to editor';
  document.body.insertBefore(link, document.body.firstChild);
}

/**
 * Initialize accessibility improvements.
 */
export function initAccessibility() {
  addSkipLink();
  createLiveRegion();

  // Add ARIA labels to key elements
  const editor = $('#editor');
  if (editor) {
    editor.setAttribute('aria-label', 'Document editor');
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
  }

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.setAttribute('role', 'navigation');

  const panel = document.querySelector('.panel');
  if (panel) panel.setAttribute('role', 'complementary');

  // Grammar results are announced explicitly by grammar.js — one
  // announcement per completed check. A MutationObserver here used to
  // fire on every keystroke because updateStats wrote 0 into #issueCount
  // (defect 6).
}
