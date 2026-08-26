/**
 * Grammar module — runs grammar checks, renders the issues panel,
 * and manages the suggestion popover.
 */

import { $, esc, notify, setStatus } from './utils.js';
import { getEditor, setIssues, replaceAt } from './editor.js';
import { persistCurrent } from './documents.js';
import { pushUndoState } from './shortcuts.js';

// ─── State ────────────────────────────────────────────────────────

let issues = [];
let seq = 0;
const ignoreKeys = new Set();

// ─── Helpers ──────────────────────────────────────────────────────

function issueKey(issue) {
  return `${issue.rule?.id || ''}|${issue.message}`;
}

// ─── Check runner ─────────────────────────────────────────────────

export async function runCheck() {
  const editor = getEditor();
  const text = editor.value;
  const id = ++seq;

  if (!text.trim()) {
    issues = [];
    setIssues([]);
    renderIssuesPanel();
    setStatus('Saved locally');
    return;
  }

  setStatus('Checking…');

  try {
    const res = await fetch('/api/grammar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Grammar check failed');
    if (id !== seq) return; // stale request

    issues = (data.matches || []).filter(m => !ignoreKeys.has(issueKey(m)));
    setIssues(issues);
    setStatus('Saved locally');
  } catch (err) {
    if (id !== seq) return;
    issues = [];
    setIssues([]);
    setStatus('Check unavailable');
    notify(err.message || 'Could not reach the grammar service');
  }

  renderIssuesPanel();
}

// ─── Debounced check ──────────────────────────────────────────────

let checkTimer = null;

export function scheduleCheck() {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(runCheck, 850);
}

// ─── Apply replacement ────────────────────────────────────────────

function applyReplacement(idx, replacementIndex) {
  const issue = issues[idx];
  if (!issue) return;

  const value = issue.replacements?.[replacementIndex]?.value;
  if (!value) {
    notify('No automatic replacement available.');
    return;
  }

  pushUndoState('Grammar fix');
  replaceAt(issue.offset, issue.length, value);
  hidePopover();
  notify('Suggestion applied');
  persistCurrent(getEditor().value);
  runCheck();
}

// ─── Ignore issue ─────────────────────────────────────────────────

function ignoreIssue(idx) {
  const issue = issues[idx];
  if (!issue) return;

  ignoreKeys.add(issueKey(issue));
  issues = issues.filter(i => i !== issue);
  setIssues(issues);
  renderIssuesPanel();
  hidePopover();
  notify('Ignored for this document');
}

// ─── Popover ──────────────────────────────────────────────────────

export function hidePopover() {
  const popover = $('#popover');
  if (popover) {
    popover.style.display = 'none';
  }
}

export function showPopover(idx, rect) {
  const issue = issues[idx];
  if (!issue) return;

  const popover = $('#popover');
  const editor = getEditor();
  const replacements = (issue.replacements || []).slice(0, 3);
  const original = editor.value.slice(issue.offset, issue.offset + issue.length);

  popover.innerHTML =
    `<div class="pop-head">` +
      `<span class="pop-type">${esc(issue.rule?.category?.name || 'Writing')}</span>` +
      `<button class="pop-x">×</button>` +
    `</div>` +
    `<div class="pop-msg">${esc(issue.message || 'Improve this text')}</div>` +
    `<div class="pop-original">${esc(original)}</div>` +
    (replacements.length
      ? `<div class="pop-repls">${replacements.map((r, k) =>
          `<button class="pop-repl" data-r="${k}">${esc(r.value)}</button>`
        ).join('')}</div>`
      : '') +
    `<div class="pop-actions">` +
      `<button class="btn primary small" id="popApply">Apply</button>` +
      `<button class="btn small" id="popIgnore">Ignore</button>` +
    `</div>`;

  popover.style.display = 'block';

  // Position the popover
  const box = editor.closest('.editor-card').getBoundingClientRect();
  let left = rect.left - box.left;
  let top = rect.bottom - box.top + 6;
  const pw = popover.offsetWidth || 290;
  const ph = popover.offsetHeight || 160;

  if (left + pw > box.width - 8) left = Math.max(8, box.width - pw - 8);
  if (top + ph > box.height - 8) top = Math.max(8, rect.top - box.top - ph - 6);

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  // Wire up button handlers
  $('#popApply').onclick = () => applyReplacement(idx, 0);
  $('#popIgnore').onclick = () => ignoreIssue(idx);
  popover.querySelector('.pop-x').onclick = hidePopover;
  popover.querySelectorAll('.pop-repl').forEach(btn => {
    btn.onclick = () => applyReplacement(idx, +btn.dataset.r);
  });
}

// ─── Issues panel ─────────────────────────────────────────────────

function renderIssuesPanel() {
  const pane = $('#tabIssues');
  const countEl = $('#issueCount');
  if (countEl) countEl.textContent = issues.length;

  if (!pane) return;

  if (!issues.length) {
    pane.innerHTML =
      '<div class="empty">' +
        '<div class="empty-icon">✓</div>' +
        '<h3>Looks good</h3>' +
        '<p>No grammar or spelling issues found.</p>' +
      '</div>';
    return;
  }

  pane.innerHTML = issues.map((x, i) => {
    const fix = x.replacements?.[0]?.value || 'Review suggestion';
    const editor = getEditor();
    const original = editor.value.slice(x.offset, x.offset + x.length);
    return (
      `<div class="issue" data-i="${i}">` +
        `<div class="issue-head">` +
          `<span class="issue-type">${esc(x.rule?.category?.name || 'Writing')} · ${esc(x.rule?.issueType || 'style')}</span>` +
          `<button class="apply" data-i="${i}">Apply</button>` +
        `</div>` +
        `<div class="issue-original">${esc(original)}</div>` +
        `<div class="issue-fix">${esc(fix)}</div>` +
        `<div class="issue-msg">${esc(x.message || 'Improve this text')}</div>` +
      `</div>`
    );
  }).join('');
}

// ─── Panel event delegation ───────────────────────────────────────

export function initGrammarPanel() {
  const pane = $('#tabIssues');
  if (!pane) return;

  pane.addEventListener('click', (e) => {
    const btn = e.target.closest('.apply');
    if (btn) {
      applyReplacement(+btn.dataset.i, 0);
      return;
    }

    const item = e.target.closest('.issue');
    if (!item) return;

    const idx = +item.dataset.i;
    const issue = issues[idx];
    if (!issue) return;

    const editor = getEditor();
    editor.focus();
    editor.setSelectionRange(issue.offset, issue.offset + issue.length);
    showPopover(idx, item.getBoundingClientRect());
  });
}

export function getIssues() {
  return issues;
}
