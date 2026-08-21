/**
 * Tab module — handles switching between Issues, Paraphrase,
 * Summarize, and Goals tabs in the right panel.
 */

import { $$ } from './utils.js';

export function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tabpane').forEach(p => p.classList.remove('active'));

      // Activate clicked tab
      tab.classList.add('active');

      // Activate corresponding pane
      const tabName = tab.dataset.tab;
      const paneId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
      const pane = document.getElementById(paneId);
      if (pane) pane.classList.add('active');
    });
  });
}
