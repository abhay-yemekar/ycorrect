/**
 * WriteRight content script — popups.
 *
 * Fix card, rewrite chip, and the text read/write helpers they depend on.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

// ─── Fix card ───────────────────────────────────────────────────
function showFixCard(match, anchorRect) {
  hideFixCard();
  ensureShadowHost();

  const replacements = (match.replacements || []).slice(0, 4);
  fixCardEl = document.createElement('div');
  fixCardEl.id = 'wr-fix-card';

  let html = `<div class="wr-fix-header">${escHtml(match.rule?.category?.name || 'Writing')} \u00b7 ${escHtml(match.rule?.issueType || 'issue')}</div>`;

  const text = getFieldText();
  const original = text.slice(match.offset, match.offset + match.length);
  if (original) html += `<div class="wr-fix-original">${escHtml(original)}</div>`;

  if (replacements.length > 0) {
    html += '<div class="wr-fix-chips">';
    for (const r of replacements) {
      html += `<button class="wr-fix-chip" data-replace="${escHtml(r.value)}">${escHtml(r.value)}</button>`;
    }
    html += '</div>';
  }

  html += `<div class="wr-fix-msg">${escHtml(match.message || 'Improve this text')}</div>`;
  html += '<div class="wr-fix-actions">';
  html += '<button class="wr-fix-btn" data-action="ignore">Ignore</button>';
  html += '<button class="wr-fix-btn primary" data-action="humanize">\u2728 Humanize sentence</button>';
  html += '</div>';

  fixCardEl.innerHTML = html;

  const top = anchorRect.bottom + 8;
  const left = Math.max(6, Math.min(anchorRect.left, window.innerWidth - 360));
  fixCardEl.style.top = `${top}px`;
  fixCardEl.style.left = `${left}px`;
  fixCardEl.style.display = 'block';

  shadowRoot.appendChild(fixCardEl);

  fixCardEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.wr-fix-chip');
    if (chip) {
      const replacement = chip.dataset.replace;
      if (replacement !== undefined) replaceMatch(match, replacement);
      hideFixCard();
      return;
    }
    const action = e.target.dataset?.action;
    if (action === 'ignore') {
      ignoreSet.add(match.rule?.id + '|' + match.message);
      clearHighlights();
      renderHighlights();
      updateIssueCount();
      updateBadgeCount();
      hideFixCard();
    } else if (action === 'humanize') {
      rewriteSentence(match, 'Humanize');
      hideFixCard();
    }
  }, true);
}

function hideFixCard() {
  if (fixCardEl) { fixCardEl.remove(); fixCardEl = null; }
}

// ─── Rewrite chip ──────────────────────────────────────────────
function showRewriteChip(sel) {
  hideRewriteChip();
  const target = captureSelectionTarget();
  if (!target) return;
  const text = target.original.trim();
  if (!text || text.length < 3) return;

  ensureShadowHost();
  rewriteChipEl = document.createElement('div');
  rewriteChipEl.id = 'wr-rewrite-chip';
  const rect = activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT'
    ? activeField.getBoundingClientRect() : sel.getRangeAt(0).getBoundingClientRect();
  rewriteChipEl.innerHTML = '<button class="wr-rewrite-btn">\u2726 Rewrite</button>';
  rewriteChipEl.style.top = `${rect.top - 44}px`;
  rewriteChipEl.style.left = `${rect.left}px`;
  rewriteChipEl.style.display = 'block';
  shadowRoot.appendChild(rewriteChipEl);

  rewriteChipEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const mode = getActiveMode();
    rewriteSelection(mode);
    hideRewriteChip();
  }, true);
}

function hideRewriteChip() {
  if (rewriteChipEl) { rewriteChipEl.remove(); rewriteChipEl = null; }
}

// ─── Text helpers ──────────────────────────────────────────────
function getFieldText(field = activeField) {
  if (!field) return '';
  if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
    return field.value;
  }
  // For contenteditable: build flat text from text nodes (no block-boundary newlines)
  // This matches what the char map produces, avoiding offset mismatches
  let result = '';
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    result += node.textContent;
  }
  return result;
}

function setFieldText(text) {
  if (!activeField) return;
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    activeField.value = text;
    activeField.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (activeField.isContentEditable) {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(activeField);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
    } else {
      activeField.textContent = text;
      activeField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }
  }
}

function replaceMatch(match, replacement) {
  const text = getFieldText();
  if (text !== _lastCheckedText) return showToast('Text changed. Check grammar again.', 'error');
  showSuggestionReview(captureReviewTarget(match.offset, match.offset + match.length), replacement, 'Grammar suggestion');
}

function replaceSelection(_originalText, replacement) {
  const field = activeField;
  if (!field) return;
  if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const val = field.value;
    field.value = val.slice(0, start) + replacement + val.slice(end);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.selectionStart = field.selectionEnd = start + replacement.length;
  } else if (field.isContentEditable) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      sel.deleteFromDocument();
      document.execCommand('insertText', false, replacement);
    }
  }
}

// A review owns its field, text snapshot and offsets, never the live selection.
let pendingReview = null;
let reviewCard = null;
let lastReviewUndo = null;
let undoCard = null;

function captureReviewTarget(start, end, field = activeField) {
  if (!field || !field.isConnected || isSkipField(field)) return null;
  const before = getFieldText(field);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > before.length) return null;
  return { field, before, start, end, original: before.slice(start, end) };
}

function captureSelectionTarget() {
  const field = activeField;
  if (!field) return null;
  if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
    return captureReviewTarget(field.selectionStart, field.selectionEnd);
  }
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!field.contains(range.startContainer) || !field.contains(range.endContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(field);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  return captureReviewTarget(start, start + range.toString().length);
}

function dismissSuggestionReview() {
  if (reviewCard) reviewCard.remove();
  reviewCard = null;
  pendingReview = null;
}

function showSuggestionReview(target, replacement, label, edits = null) {
  if (!target || typeof replacement !== 'string') return;
  if (!siteEnabled || !target.field.isConnected || getFieldText(target.field) !== target.before) {
    return showToast('Text changed. Request a new suggestion.', 'error');
  }
  dismissSuggestionReview();
  ensureShadowHost();
  pendingReview = { ...target, replacement, edits: edits || [{ start: target.start, end: target.end, replacement }] };
  reviewCard = document.createElement('div');
  reviewCard.id = 'wr-rewrite-result';
  reviewCard.setAttribute('role', 'dialog');
  reviewCard.setAttribute('aria-label', label);
  reviewCard.innerHTML = `<div class="wr-rewrite-header">${escHtml(label)}</div>
    <div>Original</div><div class="wr-review-original"><del>${escHtml(target.original)}</del></div>
    <div>Suggestion</div><div class="wr-rewrite-suggestion"><ins>${escHtml(replacement)}</ins></div>
    <div class="wr-rewrite-actions">
      <button class="wr-fix-btn primary" data-action="accept">Accept</button>
      <button class="wr-fix-btn" data-action="reject">Reject</button>
    </div><div class="wr-review-help">Ctrl+Alt+Enter: accept · Escape: reject · Ctrl+Alt+Z: undo after acceptance.</div>`;
  reviewCard.style.cssText = 'display:block;top:60px;right:16px;max-height:calc(100vh - 90px);overflow:auto;max-width:min(380px,calc(100vw - 32px))';
  reviewCard.addEventListener('click', e => {
    if (e.target.dataset.action === 'accept') acceptSuggestionReview();
    if (e.target.dataset.action === 'reject') dismissSuggestionReview();
  });
  shadowRoot.appendChild(reviewCard);
}

function writeFieldRange(field, start, end, replacement) {
  const before = getFieldText(field);
  const expected = before.slice(0, start) + replacement + before.slice(end);
  field.focus();
  if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
    // Native setter reaches controlled inputs; dispatch input after setting it.
    const prototype = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, expected);
    field.setSelectionRange(start + replacement.length, start + replacement.length);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (field.isContentEditable) {
    const range = buildRange(collectTextNodes(field).nodes, start, end);
    if (!range) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    // Let the host editor handle its own input transaction. Never replace its DOM.
    document.execCommand('insertText', false, replacement);
  } else return false;
  return getFieldText(field) === expected;
}

function applyReviewEdits(field, before, edits) {
  let expected = before;
  const inverse = [];
  const ordered = [...edits].sort((a, b) => a.start - b.start);
  let previousEnd = -1;
  let shift = 0;
  for (const edit of ordered) {
    if (edit.start < previousEnd || edit.end > before.length || edit.start < 0 || edit.end < edit.start) return null;
    inverse.push({ start: edit.start + shift, end: edit.start + shift + edit.replacement.length, replacement: before.slice(edit.start, edit.end) });
    shift += edit.replacement.length - (edit.end - edit.start);
    previousEnd = edit.end;
  }
  for (const edit of ordered.reverse()) {
    if (getFieldText(field) !== expected || !writeFieldRange(field, edit.start, edit.end, edit.replacement)) return null;
    expected = expected.slice(0, edit.start) + edit.replacement + expected.slice(edit.end);
  }
  return { field, before, after: expected, edits: inverse };
}

function acceptSuggestionReview() {
  const review = pendingReview;
  if (!review) return false;
  if (!siteEnabled || !review.field.isConnected || getFieldText(review.field) !== review.before) {
    dismissSuggestionReview();
    showToast('Text changed. Request a new suggestion.', 'error');
    return false;
  }
  const undo = applyReviewEdits(review.field, review.before, review.edits);
  dismissSuggestionReview();
  if (!undo) {
    showToast('The editor could not apply this change. Review the field; use its native undo if needed.', 'error');
    return false;
  }
  lastReviewUndo = undo;
  clearHighlights();
  currentMatches = [];
  updateBadgeCount();
  scheduleGrammarCheck();
  if (undoCard) undoCard.remove();
  undoCard = document.createElement('div');
  undoCard.className = 'wr-toast wr-toast-success';
  undoCard.innerHTML = '<span>Suggestion applied</span><button class="wr-fix-btn" data-action="undo">Undo</button>';
  undoCard.querySelector('button').addEventListener('click', undoSuggestionReview);
  shadowRoot.appendChild(undoCard);
  return true;
}

function undoSuggestionReview() {
  const undo = lastReviewUndo;
  if (!undo) return false;
  if (!siteEnabled || !undo.field.isConnected || getFieldText(undo.field) !== undo.after) {
    showToast('Text changed since acceptance. Use the editor’s undo history.', 'error');
    return false;
  }
  const result = applyReviewEdits(undo.field, undo.after, undo.edits);
  if (!result) return false;
  lastReviewUndo = null;
  if (undoCard) undoCard.remove();
  undoCard = null;
  currentMatches = [];
  clearHighlights();
  scheduleGrammarCheck();
  return true;
}

function reviewAllMatches(matches) {
  const before = getFieldText();
  if (before !== _lastCheckedText) return showToast('Text changed. Check grammar again.', 'error');
  const edits = [];
  let end = -1;
  for (const m of [...matches].sort((a, b) => a.offset - b.offset || b.length - a.length)) {
    if (!m.replacements?.length || m.offset < end) continue;
    edits.push({ start: m.offset, end: m.offset + m.length, replacement: m.replacements[0].value });
    end = m.offset + m.length;
  }
  if (!edits.length) return;
  let after = before;
  for (const e of [...edits].reverse()) after = after.slice(0, e.start) + e.replacement + after.slice(e.end);
  showSuggestionReview(captureReviewTarget(0, before.length), after, 'Review grammar fixes (overlapping alternatives omitted)', edits);
}
