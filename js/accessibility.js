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
 */
function createLiveRegion() {
  const region = document.createElement('div');
  region.id = 'a11yLive';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
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
 */
function addSkipLink() {
  const link = document.createElement('a');
  link.href = '#editor';
  link.className = 'skip-link';
  link.textContent = 'Skip to editor';
  link.style.cssText = `
    position: absolute;
    top: -100%;
    left: 16px;
    background: var(--green);
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    z-index: 999;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  `;
  link.addEventListener('focus', () => { link.style.top = '8px'; });
  link.addEventListener('blur', () => { link.style.top = '-100%'; });
  document.body.insertBefore(link, document.body.firstChild);
}

/**
 * Improve focus visibility for keyboard users.
 */
function addFocusStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 2px solid var(--green);
      outline-offset: 2px;
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--green);
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initialize accessibility improvements.
 */
export function initAccessibility() {
  addSkipLink();
  addFocusStyles();
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
