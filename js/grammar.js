/**
 * Grammar module — runs grammar checks, renders the issues panel,
 * and manages the suggestion popover.
 */

import { $, esc, notify, setStatus } from './utils.js';
import { getEditor, getOverlay, setIssues, replaceAt } from './editor.js';
import { splitParagraphs, stitchMatches, sortMatches } from './paragraphs.js';
import { getIgnoredKeys, ignoreIssuePermanently } from './documents.js';
import { pushUndoState } from './shortcuts.js';
import { announce } from './accessibility.js';

// ─── State ────────────────────────────────────────────────────────

let issues = [];
let seq = 0;

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Stable identity of an issue: rule id + message. Local rules carry ids
 * (localRules.js) and LanguageTool provides its own rule.id, so ignores
 * are precise and persist per document (defect 9).
 */
function issueKey(issue) {
  return `${issue.rule?.id || ''}|${issue.message}`;
}

// ─── Check runner ─────────────────────────────────────────────────

// Per-paragraph result cache (Phase 4): unchanged paragraphs are served
// from cache and only dirty paragraphs are sent to the server, which
// checks them in ONE batched LanguageTool request.
const paraCache = new Map(); // paragraph text → paragraph-relative matches
const PARA_CACHE_MAX = 300;

function cachePut(key, value) {
  if (paraCache.size >= PARA_CACHE_MAX) {
    paraCache.delete(paraCache.keys().next().value); // FIFO eviction
  }
  paraCache.set(key, value);
}

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
    const paragraphs = splitParagraphs(text);
    const results = new Array(paragraphs.length).fill(null);
    const dirty = [];

    paragraphs.forEach((p, i) => {
      if (!p.text.trim()) {
        results[i] = [];
        return;
      }
      const cached = paraCache.get(p.text);
      if (cached) results[i] = cached;
      else dirty.push({ index: i, text: p.text });
    });

    if (dirty.length > 0) {
      const res = await fetch('/api/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paragraphs: dirty.map(d => d.text) }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Grammar check failed');
      if (id !== seq) return; // stale request

      const fresh = data.paragraphMatches || [];
      dirty.forEach((d, k) => {
        const matches = fresh[k] || [];
        results[d.index] = matches;
        cachePut(d.text, matches);
      });
    }

    if (id !== seq) return;

    // Stitch against the CURRENT split: a paragraph edited while the
    // request was in flight gets no matches here (never misplaced
    // underlines) and is covered by the next scheduled check.
    const current = splitParagraphs(editor.value);
    const byText = new Map();
    paragraphs.forEach((p, i) => {
      if (results[i] && !byText.has(p.text)) byText.set(p.text, results[i]);
    });

    const all = sortMatches(stitchMatches(
      current,
      current.map(p => byText.get(p.text) || [])
    ));

    const ignored = new Set(getIgnoredKeys());
    issues = all.filter(m => !ignored.has(issueKey(m)));
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

  // One announcement per completed check — never per keystroke (defect 6).
  if (id === seq) {
    announce(issues.length
      ? `${issues.length} writing issue${issues.length === 1 ? '' : 's'} found`
      : 'No writing issues found');
  }
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
  // replaceAt routes through setText(), which shifts the remaining issues,
  // re-renders the overlay, and fires the input pipeline (save + re-check).
  replaceAt(issue.offset, issue.length, value);
  hidePopover();
  notify('Suggestion applied');
}

// ─── Ignore issue ─────────────────────────────────────────────────

function ignoreIssue(idx) {
  const issue = issues[idx];
  if (!issue) return;

  // Persisted with THIS document — the toast now tells the truth (defect 9)
  ignoreIssuePermanently(issueKey(issue));
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

  const fixBtn = issues.length > 0 ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#e2e8f0)"><button id="fixAllBtn" class="btn primary" style="width:100%">Fix all high-confidence issues</button></div>' : '';
  pane.innerHTML = fixBtn + issues.map((x, i) => {
    const editor = getEditor();
    const original = editor.value.slice(x.offset, x.offset + x.length);
    const repls = (x.replacements || []).slice(0, 4);
    const chips = repls.length
      ? `<div class="issue-chips">${repls.map((r, k) =>
          `<button class="issue-chip" data-i="${i}" data-r="${k}">${esc(r.value)}</button>`
        ).join('')}</div>`
      : `<div class="issue-fix">Review suggestion</div>`;
    return (
      `<div class="issue" data-i="${i}">` +
        `<div class="issue-head">` +
          `<span class="issue-type">${esc(x.rule?.category?.name || 'Writing')} · ${esc(x.rule?.issueType || 'style')}</span>` +
          `<button class="apply" data-i="${i}">Apply</button>` +
        `</div>` +
        `<div class="issue-original">${esc(original)}</div>` +
        chips +
        `<div class="issue-msg">${esc(x.message || 'Improve this text')}</div>` +
        `<button class="btn ghost small rewrite-sentence" data-sentence-rewrite="" data-offset="${x.offset}" data-length="${x.length}" title="Rewrite this sentence">✦ Rewrite sentence</button>` +
      `</div>`
    );
  }).join('');
}

// ─── Panel event delegation ───────────────────────────────────────

export function initGrammarPanel() {
  // Underline clicks: grammar owns the overlay listener so a click opens
  // the popover directly (defect 4 — the old CustomEvent had no listener).
  const overlay = getOverlay();
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      const span = e.target.closest('.u');
      if (!span) return;

      const idx = +span.dataset.i;
      const issue = issues[idx];
      if (!issue) return;

      const editor = getEditor();
      editor.focus();
      editor.setSelectionRange(issue.offset, issue.offset + issue.length);
      showPopover(idx, span.getBoundingClientRect());
    });
  }

  const pane = $('#tabIssues');
  if (!pane) return;

  pane.addEventListener('click', (e) => {
    // Replacement chip click — apply that specific replacement
    const chip = e.target.closest('.issue-chip');
    if (chip) {
      applyReplacement(+chip.dataset.i, +chip.dataset.r);
      return;
    }

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
