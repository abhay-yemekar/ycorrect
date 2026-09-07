/**
 * Tab module — switching between Issues, Paraphrase, Summarize, and Goals
 * in the right panel.
 *
 * The tabs are real ARIA tabs (defect 23 follow-up): role=tablist/tab/
 * tabpanel, aria-selected, roving tabindex, and arrow-key/Home/End
 * navigation per the WAI-ARIA tabs pattern.
 */

import { $$ } from './utils.js';

export function initTabs() {
  const tabs = [...$$('.tab')];
  if (tabs.length === 0) return;

  function activate(tab, moveFocus = false) {
    for (const t of tabs) {
      const selected = t === tab;
      t.classList.toggle('active', selected);
      t.setAttribute('aria-selected', String(selected));
      t.setAttribute('tabindex', selected ? '0' : '-1');
    }

    $$('.tabpane').forEach(p => p.classList.remove('active'));

    const tabName = tab.dataset.tab;
    const paneId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    const pane = document.getElementById(paneId);
    if (pane) pane.classList.add('active');

    if (moveFocus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => activate(tab));
  }

  const tablist = document.querySelector('[role="tablist"]');
  if (tablist) {
    tablist.addEventListener('keydown', (e) => {
      const current = tabs.findIndex(t => t.classList.contains('active'));
      if (current === -1) return;

      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(current + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(current - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];

      if (next) {
        e.preventDefault();
        activate(next, true);
      }
    });
  }
}
