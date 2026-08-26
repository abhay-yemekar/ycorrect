/**
 * yCorrect content script — in-page writing assistant.
 *
 * Detects text fields (textarea, input, contenteditable), shows a floating
 * badge on focus, runs grammar checks via the background worker, renders
 * underline highlights, and offers click-to-fix cards and selection-based
 * AI rewrite with mode chips.
 *
 * All UI lives inside a Shadow DOM so host-page CSS cannot clash.
 */



// ─── Constants ──────────────────────────────────────────────────
const DEBOUNCE_MS = 850;
const FIELD_SELECTOR = 'textarea, input[type="text"], input[type="search"], [contenteditable="true"], [contenteditable=""]';

// ─── State ──────────────────────────────────────────────────────
let activeField = null;          // the focused editable field
let activeOverlay = null;        // mirrored overlay for textarea

let badgeEl = null;              // floating badge
let toolbarEl = null;            // expanded toolbar with mode chips
let fixCardEl = null;            // inline fix card
let rewriteChipEl = null;        // selection "Rewrite" chip
let debounceTimer = null;
let scrollSyncRAF = null;
let currentMatches = [];         // grammar matches for current field
const ignoreSet = new Set();       // session-only ignore keys
const STYLES = `
/* Badge */
#yc-badge{position:fixed;z-index:2147483647;pointer-events:auto;cursor:pointer;display:none}
.yc-badge-dot{width:20px;height:20px;border-radius:50%;background:#0f766e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .15s}
.yc-badge-dot:hover{transform:scale(1.2)}
/* Toolbar */
#yc-toolbar{position:fixed;z-index:2147483647;pointer-events:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:8px;display:none;font:13px/1.5 system-ui,-apple-system,sans-serif;max-width:340px;color:#1a202c}
.yc-toolbar-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
.yc-toolbar-row:last-child{margin-bottom:0}
.yc-mode{padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#f7fafc;cursor:pointer;font-size:12px;transition:all .1s;color:#1a202c}
.yc-mode:hover{background:#edf2f7}
.yc-mode.active{background:#0f766e;color:#fff;border-color:#0f766e}
.yc-action{padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:12px;color:#1a202c;transition:background .1s}
.yc-action:hover{background:#edf2f7}
.yc-toolbar-info{font-size:11px;color:#718096;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:6px}
.yc-issue-count{font-weight:600;color:#0f766e}
.yc-toggle{padding:2px 8px;border-radius:4px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:11px;color:#1a202c}
.yc-link{padding:2px 8px;border-radius:4px;border:none;background:none;cursor:pointer;font-size:11px;color:#0f766e;text-decoration:underline}
/* Fix card */
#yc-fix-card{position:fixed;z-index:2147483647;pointer-events:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:10px 12px;display:none;font:13px/1.5 system-ui,-apple-system,sans-serif;max-width:280px;color:#1a202c}
.yc-fix-suggestion{margin-bottom:8px}
.yc-fix-label{display:block;font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
.yc-fix-text{display:block;font-size:14px;font-weight:500;color:#0f766e;background:#f0fdf4;border-radius:6px;padding:6px 8px;border-left:3px solid #0f766e}
.yc-fix-actions{display:flex;gap:6px}
.yc-fix-btn{padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:12px;color:#1a202c;transition:all .1s}
.yc-fix-btn:hover{background:#edf2f7}
.yc-fix-btn.apply{background:#0f766e;color:#fff;border-color:#0f766e}
.yc-fix-btn.apply:hover{background:#0d6b64}
/* Rewrite chip */
#yc-rewrite-chip{position:fixed;z-index:2147483647;pointer-events:auto;display:none}
.yc-rewrite-btn{padding:5px 12px;border-radius:8px;border:none;background:#0f766e;color:#fff;font-size:13px;font-weight:500;cursor:pointer;box-shadow:0 2px 8px rgba(15,118,110,.3);font-family:system-ui,-apple-system,sans-serif;transition:transform .1s}
.yc-rewrite-btn:hover{transform:scale(1.04)}
/* Rewrite result */
#yc-rewrite-result{position:fixed;z-index:2147483647;pointer-events:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:10px 12px;display:none;font:13px/1.5 system-ui,-apple-system,sans-serif;max-width:320px;color:#1a202c}
.yc-rewrite-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#0f766e;margin-bottom:6px}
.yc-rewrite-suggestion{font-size:14px;line-height:1.5;padding:8px 10px;background:#f0fdf4;border-radius:6px;border-left:3px solid #0f766e;margin-bottom:8px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}
.yc-rewrite-actions{display:flex;gap:6px}
/* Underlines */
.yc-underline{text-decoration-line:underline;text-decoration-style:wavy;text-underline-offset:3px;cursor:pointer}
.yc-misspelling,.yc-grammar{text-decoration-color:#dc2626;background:#fef2f2}
.yc-clarity{text-decoration-color:#2563eb;background:#eff6ff}
.yc-style{text-decoration-color:#ca8a04;background:#fefce8}
.yc-other{text-decoration-color:#dc2626;background:#fef2f2}
.yc-underline:hover{background:#fef08a!important}
/* Overlay */
#yc-overlay{position:fixed;pointer-events:auto;overflow:hidden;word-wrap:break-word;color:transparent;caret-color:transparent;border:1px solid transparent;margin:0;z-index:2147483647}
/* Dark mode */
@media(prefers-color-scheme:dark){#yc-toolbar,#yc-fix-card,#yc-rewrite-result{background:#1a202c;border-color:#2d3748;color:#e2e8f0}.yc-mode,.yc-action,.yc-toggle{background:#2d3748;color:#e2e8f0;border-color:#4a5568}.yc-mode:hover,.yc-action:hover{background:#4a5568}.yc-mode.active{background:#0f766e;color:#fff;border-color:#0f766e}.yc-fix-btn{background:#2d3748;color:#e2e8f0;border-color:#4a5568}.yc-fix-btn:hover{background:#4a5568}.yc-fix-text{background:#1a202c;color:#6ee7b7}.yc-rewrite-suggestion{background:#1a202c;color:#6ee7b7}.yc-link{color:#6ee7b7}}
`;
let shadowRoot = null;
let siteEnabled = true;
let grammarEnabled = true;

// ─── Shadow host ────────────────────────────────────────────────
function ensureShadowHost() {
  if (shadowRoot) return shadowRoot.host;
  const host = document.createElement('div');
  host.id = 'ycorrect-shadow-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadowRoot.appendChild(style);
  return host;
}

// ─── Badge (floating dot near focused field) ────────────────────
function showBadge(field) {
  ensureShadowHost();
  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = 'yc-badge';
    badgeEl.innerHTML = `<div class="yc-badge-dot" title="yCorrect — click for options"></div>`;
    badgeEl.addEventListener('click', onBadgeClick);
    shadowRoot.appendChild(badgeEl);
  }
  positionBadge(field);
  badgeEl.style.display = '';
}

function hideBadge() {
  if (badgeEl) badgeEl.style.display = 'none';
}

function positionBadge(field) {
  if (!badgeEl || !field) return;
  const r = field.getBoundingClientRect();
  const top = Math.max(r.top + 2, r.top - 24);
  badgeEl.style.top = `${top}px`;
  badgeEl.style.left = `${r.left + 2}px`;
}

// ─── Badge click → toggle toolbar ───────────────────────────────
function onBadgeClick(e) {
  e.stopPropagation();
  if (toolbarEl && toolbarEl.style.display !== 'none') {
    hideToolbar();
    return;
  }
  showToolbar();
}

function showToolbar() {
  ensureShadowHost();
  if (!toolbarEl) {
    toolbarEl = document.createElement('div');
    toolbarEl.id = 'yc-toolbar';
    toolbarEl.innerHTML = `
      <div class="yc-toolbar-row">
        <button class="yc-mode active" data-mode="Humanize">Humanize</button>
        <button class="yc-mode" data-mode="Fluency">Fluency</button>
        <button class="yc-mode" data-mode="Formal">Formal</button>
        <button class="yc-mode" data-mode="Shorten">Shorten</button>
        <button class="yc-mode" data-mode="Expand">Expand</button>
      </div>
      <div class="yc-toolbar-row">
        <button class="yc-action" id="yc-check">Check grammar</button>
        <button class="yc-action" id="yc-rewrite">Rewrite selection</button>
      </div>
      <div class="yc-toolbar-row yc-toolbar-info">
        <span class="yc-issue-count" id="yc-issue-count"></span>
        <button class="yc-toggle" id="yc-grammar-toggle">Grammar: ON</button>
        <button class="yc-link" id="yc-open-app">Open yCorrect</button>
      </div>`;
    toolbarEl.addEventListener('click', onToolbarClick);
    shadowRoot.appendChild(toolbarEl);
  }
  // Position near the badge
  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    toolbarEl.style.top = `${br.top}px`;
    toolbarEl.style.left = `${br.left + 32}px`;
  }
  toolbarEl.style.display = '';
  updateIssueCount();
  updateGrammarToggle();
}

function hideToolbar() {
  if (toolbarEl) toolbarEl.style.display = 'none';
}

function onToolbarClick(e) {
  const modeBtn = e.target.closest('.yc-mode');
  if (modeBtn) {
    toolbarEl.querySelectorAll('.yc-mode').forEach(b => b.classList.remove('active'));
    modeBtn.classList.add('active');
    return;
  }
  const action = e.target.id;
  if (action === 'yc-check') {
    runGrammarCheck(true);
    hideToolbar();
  } else if (action === 'yc-rewrite') {
    rewriteSelection(getActiveMode());
    hideToolbar();
  } else if (action === 'yc-grammar-toggle') {
    grammarEnabled = !grammarEnabled;
    updateGrammarToggle();
    if (!grammarEnabled) clearAllHighlights();
  } else if (action === 'yc-open-app') {
    chrome.runtime.sendMessage({ type: 'openApp' });
  }
}

function getActiveMode() {
  const active = toolbarEl?.querySelector('.yc-mode.active');
  return active?.dataset?.mode || 'Humanize';
}

function updateIssueCount() {
  const count = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message)).length;
  const el = toolbarEl?.querySelector('#yc-issue-count');
  if (el) el.textContent = count > 0 ? `${count} issue${count !== 1 ? 's' : ''}` : 'No issues';
}

function updateGrammarToggle() {
  const btn = toolbarEl?.querySelector('#yc-grammar-toggle');
  if (btn) btn.textContent = `Grammar: ${grammarEnabled ? 'ON' : 'OFF'}`;
}

// ─── Fix card (inline suggestion for a single match) ────────────
function showFixCard(match, anchorRect) {
  hideFixCard();
  ensureShadowHost();
  const suggestion = (match.replacements && match.replacements[0]) ? match.replacements[0].value : null;
  fixCardEl = document.createElement('div');
  fixCardEl.id = 'yc-fix-card';
  let html = '';
  if (suggestion) {
    html += `<div class="yc-fix-suggestion"><span class="yc-fix-label">Replace with</span><span class="yc-fix-text">${escHtml(suggestion)}</span></div>`;
    html += `<div class="yc-fix-actions"><button class="yc-fix-btn apply" data-action="apply">Replace</button>`;
  } else {
    html += `<div class="yc-fix-suggestion"><span class="yc-fix-text">${escHtml(match.message)}</span></div>`;
    html += `<div class="yc-fix-actions">`;
  }
  html += `<button class="yc-fix-btn" data-action="ignore">Ignore</button>`;
  html += `<button class="yc-fix-btn" data-action="humanize">Humanize</button>`;
  html += `</div>`;
  fixCardEl.innerHTML = html;
  fixCardEl.addEventListener('click', (e) => onFixCardClick(e, match, suggestion));

  // Position below the matched text
  const top = anchorRect.bottom + 4;
  const left = Math.max(4, Math.min(anchorRect.left, window.innerWidth - 260));
  fixCardEl.style.top = `${top}px`;
  fixCardEl.style.left = `${left}px`;
  fixCardEl.style.display = '';
  shadowRoot.appendChild(fixCardEl);
}

function hideFixCard() {
  if (fixCardEl) {
    fixCardEl.remove();
    fixCardEl = null;
  }
}

function onFixCardClick(e, match, suggestion) {
  const action = e.target.dataset?.action;
  if (!action) return;
  if (action === 'apply' && suggestion) {
    replaceMatch(match, suggestion);
  } else if (action === 'ignore') {
    ignoreSet.add(match.rule?.id + '|' + match.message);
    clearAllHighlights();
    renderHighlights();
    updateIssueCount();
  } else if (action === 'humanize') {
    rewriteSentence(match, 'Humanize');
  }
  hideFixCard();
}

// ─── Rewrite chip (appears on text selection) ───────────────────
function showRewriteChip(sel) {
  hideRewriteChip();
  if (!sel || sel.isCollapsed || !activeField) return;

  ensureShadowHost();
  rewriteChipEl = document.createElement('div');
  rewriteChipEl.id = 'yc-rewrite-chip';
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  rewriteChipEl.innerHTML = `<button class="yc-rewrite-btn">✦ Rewrite</button>`;
  rewriteChipEl.style.top = `${rect.top - 36}px`;
  rewriteChipEl.style.left = `${rect.left}px`;
  rewriteChipEl.style.display = '';
  shadowRoot.appendChild(rewriteChipEl);

  rewriteChipEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const mode = getActiveMode();
    rewriteSelection(mode);
    hideRewriteChip();
  });
}

function hideRewriteChip() {
  if (rewriteChipEl) {
    rewriteChipEl.remove();
    rewriteChipEl = null;
  }
}

// ─── Text replacement helpers ───────────────────────────────────
function getFieldText() {
  if (!activeField) return '';
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    return activeField.value;
  }
  return activeField.innerText || activeField.textContent || '';
}

function setFieldText(text) {
  if (!activeField) return;
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    activeField.value = text;
    activeField.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // contenteditable — set textContent
    activeField.textContent = text;
    activeField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  }
}

function replaceMatch(match, replacement) {
  const text = getFieldText();
  const before = text.slice(0, match.offset);
  const after = text.slice(match.offset + match.length);
  const newText = before + replacement + after;
  setFieldText(newText);
  // Re-check after a short delay
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGrammarCheck(false), 300);
}

function replaceSelection(text, replacement) {
  const field = activeField;
  if (!field) return;
  if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const val = field.value;
    field.value = val.slice(0, start) + replacement + val.slice(end);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    // Restore cursor after the replacement
    field.selectionStart = field.selectionEnd = start + replacement.length;
  } else if (field.isContentEditable) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      sel.deleteFromDocument();
      document.execCommand('insertText', false, replacement);
    }
  }
}

// ─── Mirror overlay (for textarea underline rendering) ──────────
function createOverlay() {
  ensureShadowHost();
  if (activeOverlay) return;
  activeOverlay = document.createElement('div');
  activeOverlay.id = 'yc-overlay';
  shadowRoot.appendChild(activeOverlay);
}

function removeOverlay() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
}

function syncOverlay() {
  if (!activeOverlay || !activeField || (activeField.tagName !== 'TEXTAREA' && activeField.tagName !== 'INPUT')) return;
  const cs = getComputedStyle(activeField);
  const r = activeField.getBoundingClientRect();
  activeOverlay.style.width = `${r.width}px`;
  activeOverlay.style.height = `${r.height}px`;
  activeOverlay.style.top = `${r.top}px`;
  activeOverlay.style.left = `${r.left}px`;
  activeOverlay.style.font = cs.font;
  activeOverlay.style.lineHeight = cs.lineHeight;
  activeOverlay.style.letterSpacing = cs.letterSpacing;
  activeOverlay.style.wordSpacing = cs.wordSpacing;
  activeOverlay.style.whiteSpace = cs.whiteSpace;
  activeOverlay.style.overflow = cs.overflow;
  activeOverlay.style.border = `${cs.borderWidth} solid transparent`;
  activeOverlay.style.padding = cs.padding;
  activeOverlay.scrollTop = activeField.scrollTop;
  activeOverlay.scrollLeft = activeField.scrollLeft;
}

function renderOverlayMatches() {
  if (!activeOverlay) return;
  const text = getFieldText();
  if (!text) { activeOverlay.innerHTML = ''; return; }
  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));
  // Sort by offset descending so insertions don't shift earlier offsets
  const sorted = [...visible].sort((a, b) => b.offset - a.offset);
  let html = escHtml(text);
  // Insert markers in reverse offset order
  for (const m of sorted) {
    const start = m.offset;
    const end = m.offset + m.length;
    if (start < 0 || end > html.length) continue;
    const before = html.slice(0, start);
    const matched = html.slice(start, end);
    const after = html.slice(end);
    const type = m.rule?.issueType || 'other';
    html = `${before}<span class="yc-underline yc-${type}" data-yc-offset="${start}">${matched}</span>${after}`;
  }
  activeOverlay.innerHTML = html;
}

// ─── Contenteditable highlight rendering ────────────────────────
function renderContentEditableHighlights() {
  // For contenteditable, we create highlight spans directly in the shadow DOM overlay
  clearAllHighlights();
  if (!activeField || !activeField.isContentEditable) return;
  // Use an overlay positioned over the contenteditable
  createOverlay();
  syncOverlay();
  const text = getFieldText();
  if (!text) return;
  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));
  const sorted = [...visible].sort((a, b) => b.offset - a.offset);
  let html = escHtml(text);
  for (const m of sorted) {
    const start = m.offset;
    const end = m.offset + m.length;
    if (start < 0 || end > html.length) continue;
    const before = html.slice(0, start);
    const matched = html.slice(start, end);
    const after = html.slice(end);
    const type = m.rule?.issueType || 'other';
    html = `${before}<span class="yc-underline yc-${type}" data-yc-offset="${start}">${matched}</span>${after}`;
  }
  activeOverlay.innerHTML = html;
}

// ─── Underline click handling ───────────────────────────────────
function onOverlayClick(e) {
  const underline = e.target.closest('.yc-underline');
  if (!underline) { hideFixCard(); return; }
  const offset = parseInt(underline.dataset.ycOffset, 10);
  const match = currentMatches.find(m => m.offset === offset);
  if (!match) return;
  const rect = underline.getBoundingClientRect();
  showFixCard(match, rect);
}

// ─── Scroll sync ────────────────────────────────────────────────
function scheduleScrollSync() {
  if (scrollSyncRAF) cancelAnimationFrame(scrollSyncRAF);
  scrollSyncRAF = requestAnimationFrame(syncOverlay);
}

// ─── Grammar check ──────────────────────────────────────────────
async function runGrammarCheck(_force) {
  const text = getFieldText();
  if (!text || text.trim().length < 3) {
    currentMatches = [];
    clearAllHighlights();
    updateIssueCount();
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'checkGrammar',
      text,
    });
    if (resp && resp.matches) {
      currentMatches = resp.matches;
      clearAllHighlights();
      renderHighlights();
      updateIssueCount();
    }
  } catch {
    // Server unreachable — silently ignore
  }
}

function renderHighlights() {
  if (!activeField) return;
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    createOverlay();
    syncOverlay();
    renderOverlayMatches();
  } else if (activeField.isContentEditable) {
    renderContentEditableHighlights();
  }
}

function clearAllHighlights() {
  if (activeOverlay) activeOverlay.innerHTML = '';
}

// ─── AI rewrite (selection or sentence) ─────────────────────────
async function rewriteSelection(mode) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const selectedText = sel.toString().trim();
  if (!selectedText || selectedText.length < 3) return;

  // Show loading state on the rewrite chip
  hideRewriteChip();

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'rewrite',
      text: selectedText,
      mode,
    });
    if (resp && resp.suggestion) {
      showRewriteResult(selectedText, resp.suggestion, mode);
    }
  } catch {
    // Server unreachable
  }
}

function rewriteSentence(match, mode) {
  if (!activeField) return;
  const text = getFieldText();
  // Find sentence boundaries around the match
  const sentStart = text.lastIndexOf('.', match.offset - 1) + 1;
  const sentEnd = text.indexOf('.', match.offset + match.length);
  const sentence = text.slice(sentStart, sentEnd > 0 ? sentEnd + 1 : text.length).trim();
  if (!sentence) return;

  rewriteWithSentence(sentence, mode, sentStart, sentEnd > 0 ? sentEnd + 1 : text.length);
}

async function rewriteWithSentence(sentence, mode, sentStart, sentEnd) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'rewrite',
      text: sentence,
      mode,
    });
    if (resp && resp.suggestion) {
      const text = getFieldText();
      const newText = text.slice(0, sentStart) + resp.suggestion + text.slice(sentEnd);
      setFieldText(newText);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runGrammarCheck(false), 300);
    }
  } catch {
    // Server unreachable
  }
}

function showRewriteResult(original, suggestion, mode) {
  ensureShadowHost();
  const card = document.createElement('div');
  card.id = 'yc-rewrite-result';
  card.innerHTML = `
    <div class="yc-rewrite-header">${escHtml(mode)} rewrite</div>
    <div class="yc-rewrite-suggestion">${escHtml(suggestion)}</div>
    <div class="yc-rewrite-actions">
      <button class="yc-fix-btn apply" data-action="replace">Replace</button>
      <button class="yc-fix-btn" data-action="copy">Copy</button>
      <button class="yc-fix-btn" data-action="dismiss">Dismiss</button>
    </div>`;

  // Position near the badge
  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    card.style.top = `${br.top}px`;
    card.style.left = `${Math.min(br.left, window.innerWidth - 320)}px`;
  } else {
    card.style.top = '20px';
    card.style.left = '20px';
  }
  card.style.display = '';
  shadowRoot.appendChild(card);

  card.addEventListener('click', async (e) => {
    const action = e.target.dataset?.action;
    if (action === 'replace') {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        replaceSelection(sel.toString(), suggestion);
      }
      card.remove();
    } else if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(suggestion);
        e.target.textContent = 'Copied ✓';
      } catch {
        e.target.textContent = 'Copy failed';
      }
    } else if (action === 'dismiss') {
      card.remove();
    }
  });
}

// ─── Field focus / blur ─────────────────────────────────────────
function onFieldFocus(e) {
  const field = e.target;
  if (!field.matches?.(FIELD_SELECTOR)) return;
  activeField = field;
  currentMatches = [];
  hideFixCard();
  hideRewriteChip();
  showBadge(field);
  // Start grammar check after a short delay
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGrammarCheck(false), DEBOUNCE_MS);
  // Listen for input
  field.addEventListener('input', onFieldInput);
  field.addEventListener('scroll', scheduleScrollSync);
}

function onFieldBlur(e) {
  // Check if the new focus target is inside our shadow DOM
  const related = e.relatedTarget;
  if (related && related.closest?.('#ycorrect-shadow-host')) return;
  // Small delay to allow fix-card clicks to register
  setTimeout(() => {
    if (activeField && !activeField.matches(':focus-within')) {
      activeField = null;
      hideBadge();
      hideToolbar();
      hideFixCard();
      hideRewriteChip();
      removeOverlay();
      clearAllHighlights();
      currentMatches = [];
    }
  }, 200);
}

function onFieldInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (grammarEnabled) runGrammarCheck(false);
  }, DEBOUNCE_MS);
}

// ─── Selection change (show Rewrite chip) ───────────────────────
function onSelectionChange() {
  if (!activeField) return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && activeField.contains(sel.anchorNode)) {
    showRewriteChip(sel);
  } else {
    hideRewriteChip();
  }
}

// ─── Escape HTML ────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Site-enabled check ─────────────────────────────────────────
async function checkSiteEnabled() {
  try {
    const data = await chrome.storage.sync.get({ disabledSites: [], grammarEnabled: true });
    const host = location.hostname;
    siteEnabled = !data.disabledSites.includes(host);
    grammarEnabled = data.grammarEnabled !== false;
  } catch {
    siteEnabled = true;
  }
}

// ─── Init ───────────────────────────────────────────────────────
async function init() {
  await checkSiteEnabled();
  if (!siteEnabled) return;

  // Listen for focus on any existing and future fields
  document.addEventListener('focusin', onFieldFocus, true);
  document.addEventListener('blur', onFieldBlur, true);
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('click', onOverlayClick);

  // Watch for dynamically added fields (SPA navigation)
  const observer = new MutationObserver(() => {});
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
