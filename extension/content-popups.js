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
      if (replacement) replaceMatch(match, replacement);
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
  if (!sel || sel.isCollapsed || !activeField) return;
  const text = sel.toString().trim();
  if (!text || text.length < 3) return;

  ensureShadowHost();
  rewriteChipEl = document.createElement('div');
  rewriteChipEl.id = 'wr-rewrite-chip';
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  rewriteChipEl.innerHTML = '<button class="wr-rewrite-btn">\u2726 Rewrite</button>';
  rewriteChipEl.style.top = `${rect.top - 44}px`;
  rewriteChipEl.style.left = `${rect.left}px`;
  rewriteChipEl.style.display = 'block';
  shadowRoot.appendChild(rewriteChipEl);

  rewriteChipEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const mode = getActiveMode();
    rewriteSelection(mode);
    hideRewriteChip();
  }, true);
}

function hideRewriteChip() {
  if (rewriteChipEl) { rewriteChipEl.remove(); rewriteChipEl = null; }
}

// ─── Text helpers ──────────────────────────────────────────────
function getFieldText() {
  if (!activeField) return '';
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    return activeField.value;
  }
  // For contenteditable: build flat text from text nodes (no block-boundary newlines)
  // This matches what the char map produces, avoiding offset mismatches
  let result = '';
  const walker = document.createTreeWalker(activeField, NodeFilter.SHOW_TEXT, null);
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
  const before = text.slice(0, match.offset);
  const after = text.slice(match.offset + match.length);
  setFieldText(before + replacement + after);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGrammarCheck(), 300);
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

