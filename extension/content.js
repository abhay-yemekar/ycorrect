/**
 * yCorrect content script — in-page writing assistant.
 *
 * Detects text fields (textarea, input, contenteditable, role="textbox"),
 * shows a floating badge on focus, runs grammar checks via the background
 * worker, renders underline highlights using Grammarly-style Range.getClientRects(),
 * and offers click-to-fix cards and selection-based AI rewrite with mode chips.
 *
 * All UI lives inside a Shadow DOM so host-page CSS cannot clash.
 *
 * Designed to work with React/ProseMirror SPAs (ChatGPT, Notion, Gemini, etc.)
 * where native `input` events may not fire on contenteditable elements.
 */

// ─── Constants ──────────────────────────────────────────────────
const DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 1500;
const FIELD_SELECTOR = [
  'textarea',
  'input[type="text"]',
  'input[type="search"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
].join(', ');

// ─── State ──────────────────────────────────────────────────────
let activeField = null;
let badgeEl = null;
let toolbarEl = null;
let fixCardEl = null;
let rewriteChipEl = null;
let highlightsContainer = null;
let debounceTimer = null;
let pollTimer = null;
let lastPollText = '';
let currentMatches = [];
const ignoreSet = new Set();

// ─── Shadow DOM styles ─────────────────────────────────────────
const STYLES = `
/* Badge */
#yc-badge{
  position:fixed;z-index:2147483647;pointer-events:auto!important;
  cursor:pointer;display:none;
  top:10px;right:10px;
}
.yc-badge-inner{
  width:32px;height:32px;border-radius:50%;
  background:linear-gradient(135deg,#0d9488,#0f766e);
  border:2px solid rgba(255,255,255,0.9);
  box-shadow:0 2px 10px rgba(0,0,0,.3);
  display:flex;align-items:center;justify-content:center;
  font-size:13px;color:#fff;font-weight:700;
  font-family:system-ui,-apple-system,sans-serif;
  transition:transform .15s,box-shadow .15s;
  letter-spacing:-0.5px;
}
.yc-badge-inner:hover{
  transform:scale(1.12);
  box-shadow:0 3px 14px rgba(13,148,136,.5);
}
.yc-badge-count{
  position:absolute;top:-4px;right:-4px;
  background:#ef4444;color:#fff;font-size:10px;font-weight:700;
  border-radius:50%;min-width:16px;height:16px;
  display:flex;align-items:center;justify-content:center;
  border:1.5px solid #fff;
  font-family:system-ui,-apple-system,sans-serif;
}

/* Toolbar */
#yc-toolbar{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.15),0 2px 8px rgba(0,0,0,.08);
  padding:10px 12px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:360px;color:#1a202c;
  animation:ycFadeIn .15s ease;
}
@keyframes ycFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.yc-toolbar-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}
.yc-toolbar-row:last-child{margin-bottom:0}
.yc-mode{
  padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;
  background:#f7fafc;cursor:pointer;font-size:12px;
  transition:all .1s;color:#1a202c;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-mode:hover{background:#edf2f7}
.yc-mode.active{background:#0f766e;color:#fff;border-color:#0f766e}
.yc-action{
  padding:5px 12px;border-radius:8px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:12px;color:#1a202c;
  transition:background .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-action:hover{background:#edf2f7}
.yc-toolbar-info{
  font-size:11px;color:#718096;justify-content:space-between;
  align-items:center;border-top:1px solid #e2e8f0;padding-top:6px;
  display:flex;gap:4px;
}
.yc-issue-count{font-weight:600;color:#0f766e}
.yc-toggle{
  padding:3px 8px;border-radius:6px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:11px;color:#1a202c;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-link{
  padding:3px 8px;border-radius:6px;border:none;background:none;
  cursor:pointer;font-size:11px;color:#0f766e;text-decoration:underline;
  font-family:system-ui,-apple-system,sans-serif;
}

/* Fix card */
#yc-fix-card{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.15),0 2px 8px rgba(0,0,0,.08);
  padding:12px 14px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  min-width:220px;max-width:340px;color:#1a202c;
  animation:ycFadeIn .15s ease;
}
.yc-fix-header{
  font-size:11px;text-transform:uppercase;letter-spacing:.05em;
  color:#718096;margin-bottom:6px;font-weight:600;
}
.yc-fix-original{
  font-size:12px;color:#94a3b8;text-decoration:line-through;margin-bottom:6px;
}
.yc-fix-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.yc-fix-chip{
  padding:5px 10px;border-radius:8px;border:1.5px solid #0f766e;
  background:#f0fdfa;cursor:pointer;font-size:13px;font-weight:500;
  color:#0f766e;transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-fix-chip:hover{background:#0f766e;color:#fff}
.yc-fix-msg{font-size:12px;color:#64748b;margin-bottom:8px;line-height:1.4}
.yc-fix-actions{display:flex;gap:6px}
.yc-fix-btn{
  padding:5px 14px;border-radius:8px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:12px;color:#1a202c;
  transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-fix-btn:hover{background:#edf2f7}
.yc-fix-btn.apply{background:#0f766e;color:#fff;border-color:#0f766e}
.yc-fix-btn.apply:hover{background:#0d6b64}

/* Rewrite chip (appears on text selection) */
#yc-rewrite-chip{
  position:fixed;z-index:2147483647;pointer-events:auto;display:none;
}
.yc-rewrite-btn{
  padding:6px 14px;border-radius:10px;border:none;
  background:linear-gradient(135deg,#0d9488,#0f766e);
  color:#fff;font-size:13px;font-weight:600;cursor:pointer;
  box-shadow:0 3px 12px rgba(15,118,110,.4);
  font-family:system-ui,-apple-system,sans-serif;
  transition:transform .1s;
  animation:ycFadeIn .12s ease;
}
.yc-rewrite-btn:hover{transform:scale(1.04)}

/* Rewrite result */
#yc-rewrite-result{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.15);
  padding:12px 14px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:360px;color:#1a202c;
  animation:ycFadeIn .15s ease;
}
.yc-rewrite-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#0f766e;margin-bottom:6px}
.yc-rewrite-suggestion{
  font-size:14px;line-height:1.6;padding:10px 12px;
  background:#f0fdf4;border-radius:8px;border-left:3px solid #0f766e;
  margin-bottom:8px;white-space:pre-wrap;word-break:break-word;
  max-height:200px;overflow-y:auto;
}
.yc-rewrite-actions{display:flex;gap:6px}

/* Underline highlights (Grammarly-style: positioned absolutely on top of text) */
.yc-highlight{
  position:absolute;pointer-events:auto;cursor:pointer;
  background:transparent;border-bottom:2px solid #dc2626;
  border-radius:1px;transition:background .1s;
}
.yc-highlight:hover{background:rgba(220,38,38,.1)}
.yc-highlight[data-issue-type="misspelling"]{border-bottom-color:#dc2626}
.yc-highlight[data-issue-type="grammar"]{border-bottom-color:#dc2626}
.yc-highlight[data-issue-type="clarity"]{border-bottom-color:#2563eb}
.yc-highlight[data-issue-type="style"]{border-bottom-color:#ca8a04}
.yc-highlight[data-issue-type="other"]{border-bottom-color:#dc2626}

/* Synonym card */
#yc-synonym-card{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.15);
  padding:12px 14px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:300px;min-width:180px;color:#1a202c;
  animation:ycFadeIn .15s ease;
}
.yc-syn-word{
  padding:3px 8px;border-radius:6px;border:1px solid #e2e8f0;
  background:#f7fafc;cursor:pointer;font-size:12px;color:#1a202c;
  transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.yc-syn-word:hover{background:#0f766e!important;color:#fff!important;border-color:#0f766e!important}

/* Dark mode */
@media(prefers-color-scheme:dark){
  #yc-toolbar,#yc-fix-card,#yc-rewrite-result,#yc-synonym-card{
    background:#1e293b;border-color:#334155;color:#e2e8f0;
  }
  .yc-mode,.yc-action,.yc-toggle{
    background:#334155;color:#e2e8f0;border-color:#475569;
  }
  .yc-mode:hover,.yc-action:hover{background:#475569}
  .yc-mode.active{background:#0f766e;color:#fff;border-color:#0f766e}
  .yc-fix-btn{background:#334155;color:#e2e8f0;border-color:#475569}
  .yc-fix-btn:hover{background:#475569}
  .yc-fix-chip{background:#1e293b;color:#5eead4;border-color:#0f766e}
  .yc-fix-chip:hover{background:#0f766e;color:#fff}
  .yc-rewrite-suggestion{background:#1e293b;color:#5eead4}
  .yc-link{color:#5eead4}
  .yc-highlight:hover{background:rgba(220,38,38,.15)}
  .yc-synonym-card{background:#1e293b;border-color:#334155;color:#e2e8f0}
  .yc-syn-word{background:#334155;color:#e2e8f0;border-color:#475569}
}
`;

let shadowRoot = null;
let siteEnabled = true;
let grammarEnabled = true;

// ─── Shadow host ────────────────────────────────────────────────
function ensureShadowHost() {
  if (shadowRoot) return shadowRoot.host;
  const host = document.createElement('div');
  host.id = 'ycorrect-shadow-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;overflow:visible;';
  document.documentElement.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadowRoot.appendChild(style);
  return host;
}

// ─── Escape HTML ────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Field detection (walks up the DOM) ─────────────────────────
function findEditable(el) {
  if (!el || el === document.body || el === document.documentElement) return null;
  // Skip our own UI
  if (el.closest && el.closest('#ycorrect-shadow-host')) return null;
  if (el.shadowRoot) return null;

  // Direct match
  if (el.matches && el.matches(FIELD_SELECTOR)) return el;
  if (el.isContentEditable) return el;

  // Walk up (max 10 levels) to find an editable ancestor
  let cur = el;
  for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
    if (cur.isContentEditable) return cur;
    if (cur.matches && cur.matches(FIELD_SELECTOR)) return cur;
    cur = cur.parentElement;
  }

  // Check children as last resort (for React portals)
  if (el.querySelector) {
    const child = el.querySelector(FIELD_SELECTOR);
    if (child && child.isContentEditable) return child;
  }

  return null;
}

// ─── Badge ──────────────────────────────────────────────────────
function showBadge(field) {
  ensureShadowHost();
  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = 'yc-badge';
    badgeEl.innerHTML = `<div class="yc-badge-inner" title="yCorrect — click for writing tools">yC</div>`;
    badgeEl.addEventListener('click', onBadgeClick, true);
    shadowRoot.appendChild(badgeEl);
  }
  positionBadge(field);
  badgeEl.style.display = 'block'; // CRITICAL: must be 'block', NOT '' which falls back to display:none
}

function hideBadge() {
  if (badgeEl) badgeEl.style.display = 'none';
}

function positionBadge(field) {
  if (!badgeEl || !field) return;
  const r = field.getBoundingClientRect();
  // Position at top-right corner of the field
  const top = Math.max(6, r.top - 40);
  const left = Math.min(r.right - 40, window.innerWidth - 44);
  badgeEl.style.top = `${top}px`;
  badgeEl.style.left = `${Math.max(6, left)}px`;
}

function updateBadgeCount() {
  if (!badgeEl) return;
  const count = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message)).length;
  const existing = badgeEl.querySelector('.yc-badge-count');
  if (count > 0) {
    if (!existing) {
      const dot = document.createElement('div');
      dot.className = 'yc-badge-count';
      badgeEl.appendChild(dot);
    }
    badgeEl.querySelector('.yc-badge-count').textContent = count > 9 ? '9+' : String(count);
  } else if (existing) {
    existing.remove();
  }
}

// ─── Badge click → toggle toolbar ───────────────────────────────
function onBadgeClick(e) {
  e.stopPropagation();
  e.preventDefault();
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
        <button class="yc-mode active" data-mode="Humanize">✨ Humanize</button>
        <button class="yc-mode" data-mode="Fluency">📖 Fluency</button>
        <button class="yc-mode" data-mode="Formal">👔 Formal</button>
        <button class="yc-mode" data-mode="Shorten">✂️ Shorten</button>
        <button class="yc-mode" data-mode="Expand">📝 Expand</button>
        <button class="yc-mode" data-mode="Creative">🎨 Creative</button>
      </div>
      <div class="yc-toolbar-row">
        <button class="yc-action" id="yc-check">✓ Check grammar</button>
        <button class="yc-action" id="yc-rewrite">✦ Rewrite selection</button>
      </div>
      <div class="yc-toolbar-row yc-toolbar-info">
        <span class="yc-issue-count" id="yc-issue-count"></span>
        <button class="yc-toggle" id="yc-grammar-toggle">Grammar: ON</button>
        <button class="yc-link" id="yc-open-app">Open yCorrect</button>
      </div>`;
    toolbarEl.addEventListener('click', onToolbarClick, true);
    shadowRoot.appendChild(toolbarEl);
  }
  // Position below the badge
  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    toolbarEl.style.top = `${br.bottom + 6}px`;
    toolbarEl.style.left = `${Math.max(6, br.left - 60)}px`;
  } else {
    toolbarEl.style.top = '60px';
    toolbarEl.style.right = '10px';
    toolbarEl.style.left = 'auto';
  }
  toolbarEl.style.display = 'block'; // CRITICAL: must be 'block'
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
    if (!grammarEnabled) clearHighlights();
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
  if (el) el.textContent = count > 0 ? `${count} issue${count !== 1 ? 's' : ''} found` : 'No issues found';
}

function updateGrammarToggle() {
  const btn = toolbarEl?.querySelector('#yc-grammar-toggle');
  if (btn) btn.textContent = `Grammar: ${grammarEnabled ? 'ON' : 'OFF'}`;
}

// ─── Fix card (inline suggestion for a single match) ────────────
function showFixCard(match, anchorRect) {
  hideFixCard();
  ensureShadowHost();

  const replacements = (match.replacements || []).slice(0, 4);
  fixCardEl = document.createElement('div');
  fixCardEl.id = 'yc-fix-card';

  let html = `<div class="yc-fix-header">${escHtml(match.rule?.category?.name || 'Writing')} · ${escHtml(match.rule?.issueType || 'issue')}</div>`;

  // Show original text
  const editor = activeField;
  if (editor) {
    const text = getFieldText();
    const original = text.slice(match.offset, match.offset + match.length);
    if (original) html += `<div class="yc-fix-original">${escHtml(original)}</div>`;
  }

  // Show replacement chips
  if (replacements.length > 0) {
    html += '<div class="yc-fix-chips">';
    for (const r of replacements) {
      html += `<button class="yc-fix-chip" data-replace="${escHtml(r.value)}">${escHtml(r.value)}</button>`;
    }
    html += '</div>';
  }

  // Show message
  html += `<div class="yc-fix-msg">${escHtml(match.message || 'Improve this text')}</div>`;

  // Action buttons
  html += '<div class="yc-fix-actions">';
  html += '<button class="yc-fix-btn" data-action="ignore">Ignore</button>';
  html += '<button class="yc-fix-btn" data-action="humanize">✨ Humanize sentence</button>';
  html += '</div>';

  fixCardEl.innerHTML = html;

  // Position below the matched text
  const top = anchorRect.bottom + 6;
  const left = Math.max(6, Math.min(anchorRect.left, window.innerWidth - 340));
  fixCardEl.style.top = `${top}px`;
  fixCardEl.style.left = `${left}px`;
  fixCardEl.style.display = 'block'; // CRITICAL: must be 'block'

  shadowRoot.appendChild(fixCardEl);

  // Event delegation for fix card
  fixCardEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.yc-fix-chip');
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
  if (fixCardEl) {
    fixCardEl.remove();
    fixCardEl = null;
  }
}

// ─── Rewrite chip (appears on text selection) ───────────────────
function showRewriteChip(sel) {
  hideRewriteChip();
  if (!sel || sel.isCollapsed || !activeField) return;
  const text = sel.toString().trim();
  if (!text || text.length < 3) return;

  ensureShadowHost();
  rewriteChipEl = document.createElement('div');
  rewriteChipEl.id = 'yc-rewrite-chip';
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  rewriteChipEl.innerHTML = `<button class="yc-rewrite-btn">✦ Rewrite</button>`;
  rewriteChipEl.style.top = `${rect.top - 40}px`;
  rewriteChipEl.style.left = `${rect.left}px`;
  rewriteChipEl.style.display = 'block'; // CRITICAL
  shadowRoot.appendChild(rewriteChipEl);

  rewriteChipEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const mode = getActiveMode();
    rewriteSelection(mode);
    hideRewriteChip();
  }, true);
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
  } else if (activeField.isContentEditable) {
    // For contenteditable, use execCommand to preserve undo history
    // First select all, then insert
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
  const newText = before + replacement + after;
  setFieldText(newText);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runGrammarCheck(), 300);
}

function replaceSelection(originalText, replacement) {
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

// ─── Grammarly-style highlights (Range.getClientRects) ──────────
/**
 * Instead of an overlay that mirrors text (which is fragile),
 * we use Range.getClientRects() to find the exact pixel positions
 * of each grammar error and draw thin highlight divs on top.
 * This is how Grammarly does it.
 */

function createHighlightsContainer() {
  if (highlightsContainer && document.body.contains(highlightsContainer)) return;
  highlightsContainer = document.createElement('div');
  highlightsContainer.id = 'yc-highlights';
  highlightsContainer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;overflow:visible;';
  document.body.appendChild(highlightsContainer);
}

function removeHighlightsContainer() {
  if (highlightsContainer) {
    highlightsContainer.remove();
    highlightsContainer = null;
  }
}

function clearHighlights() {
  if (highlightsContainer) {
    highlightsContainer.innerHTML = '';
  }
}

/**
 * Find a text node and offset within the active field that corresponds
 * to a character offset in getFieldText().
 */
function findTextNodeAtOffset(root, charOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let cumulative = 0;
  let node;
  while ((node = walker.nextNode())) {
    const nodeLen = node.textContent.length;
    if (cumulative + nodeLen > charOffset) {
      return { node, offset: charOffset - cumulative };
    }
    cumulative += nodeLen;
  }
  return null;
}

/**
 * Create a Range for a text span [start, start+len] within the field.
 */
function createRangeForMatch(field, start, len) {
  const text = getFieldText();
  if (start < 0 || start + len > text.length) return null;

  const startNode = findTextNodeAtOffset(field, start);
  const endNode = findTextNodeAtOffset(field, start + len);
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode.node, startNode.offset);
  range.setEnd(endNode.node, endNode.offset);
  return range;
}

/**
 * Render underline highlights for all current matches using Range.getClientRects().
 */
function renderHighlights() {
  clearHighlights();
  if (!activeField) return;

  createHighlightsContainer();
  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));

  for (const match of visible) {
    const range = createRangeForMatch(activeField, match.offset, match.length);
    if (!range) continue;

    const rects = range.getClientRects();
    if (!rects || rects.length === 0) continue;

    const issueType = match.rule?.issueType || 'other';

    for (const rect of rects) {
      // Skip very thin rects (empty lines etc)
      if (rect.width < 2) continue;

      const hl = document.createElement('div');
      hl.className = 'yc-highlight';
      hl.dataset.issueType = issueType;
      hl.dataset.matchOffset = String(match.offset);
      hl.style.position = 'fixed'; // fixed = relative to viewport, simpler than absolute
      hl.style.left = `${rect.left}px`;
      hl.style.top = `${rect.top + rect.height - 3}px`; // bottom of the text line
      hl.style.width = `${rect.width}px`;
      hl.style.height = '3px';
      hl.style.pointerEvents = 'auto';
      highlightsContainer.appendChild(hl);
    }

    range.detach();
  }
}

function onHighlightClick(e) {
  const hl = e.target.closest('.yc-highlight');
  if (!hl) { hideFixCard(); return; }
  const offset = parseInt(hl.dataset.matchOffset, 10);
  const match = currentMatches.find(m => m.offset === offset);
  if (!match) return;
  const rect = hl.getBoundingClientRect();
  showFixCard(match, rect);
}

// ─── Grammar check ──────────────────────────────────────────────
async function runGrammarCheck() {
  const text = getFieldText();
  if (!text || text.trim().length < 3) {
    currentMatches = [];
    clearHighlights();
    updateIssueCount();
    updateBadgeCount();
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'checkGrammar', text });
    if (resp && resp.matches) {
      currentMatches = resp.matches;
      clearHighlights();
      renderHighlights();
      updateIssueCount();
      updateBadgeCount();
    }
  } catch {
    // Server unreachable — silently ignore
  }
}

function scheduleGrammarCheck() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (grammarEnabled && activeField) runGrammarCheck();
  }, DEBOUNCE_MS);
}

// ─── AI rewrite (selection or sentence) ─────────────────────────
async function rewriteSelection(mode) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const selectedText = sel.toString().trim();
  if (!selectedText || selectedText.length < 3) return;

  hideRewriteChip();

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'rewrite', text: selectedText, mode });
    if (resp && resp.suggestion) {
      showRewriteResult(selectedText, resp.suggestion, mode);
    }
  } catch { /* Server unreachable */ }
}

function rewriteSentence(match, mode) {
  if (!activeField) return;
  const text = getFieldText();
  const sentStart = text.lastIndexOf('.', match.offset - 1) + 1;
  const sentEnd = text.indexOf('.', match.offset + match.length);
  const sentence = text.slice(sentStart, sentEnd > 0 ? sentEnd + 1 : text.length).trim();
  if (!sentence) return;
  rewriteWithSentence(sentence, mode, sentStart, sentEnd > 0 ? sentEnd + 1 : text.length);
}

async function rewriteWithSentence(sentence, mode, sentStart, sentEnd) {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'rewrite', text: sentence, mode });
    if (resp && resp.suggestion) {
      const text = getFieldText();
      const newText = text.slice(0, sentStart) + resp.suggestion + text.slice(sentEnd);
      setFieldText(newText);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runGrammarCheck(), 300);
    }
  } catch { /* Server unreachable */ }
}

function showRewriteResult(original, suggestion, mode) {
  ensureShadowHost();
  const card = document.createElement('div');
  card.id = 'yc-rewrite-result';
  card.innerHTML = `
    <div class="yc-rewrite-header">✦ ${escHtml(mode)} rewrite</div>
    <div class="yc-rewrite-suggestion">${escHtml(suggestion)}</div>
    <div class="yc-rewrite-actions">
      <button class="yc-fix-btn apply" data-action="replace">Replace</button>
      <button class="yc-fix-btn" data-action="copy">Copy</button>
      <button class="yc-fix-btn" data-action="dismiss">Dismiss</button>
    </div>`;

  // Position near badge or center of screen
  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    card.style.top = `${br.bottom + 6}px`;
    card.style.left = `${Math.max(6, br.left - 100)}px`;
  } else {
    card.style.top = '80px';
    card.style.left = '50%';
    card.style.transform = 'translateX(-50%)';
  }
  card.style.display = 'block'; // CRITICAL
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
        e.target.textContent = '✓ Copied';
      } catch {
        e.target.textContent = 'Copy failed';
      }
    } else if (action === 'dismiss') {
      card.remove();
    }
  }, true);
}

// ─── Synonym card ───────────────────────────────────────────────
let synonymCard = null;

function wordAtCursor(text, pos) {
  let start = pos;
  while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
  let end = pos;
  while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;
  return { word: text.slice(start, end), start, end };
}

async function showSynonyms(word, anchorRect) {
  hideSynonymCard();
  ensureShadowHost();

  synonymCard = document.createElement('div');
  synonymCard.id = 'yc-synonym-card';
  synonymCard.innerHTML = '<div style="padding:8px;color:#718096;font-size:12px">Loading synonyms…</div>';
  const top = anchorRect.bottom + 6;
  const left = Math.max(6, Math.min(anchorRect.left, window.innerWidth - 300));
  synonymCard.style.top = `${top}px`;
  synonymCard.style.left = `${left}px`;
  synonymCard.style.display = 'block'; // CRITICAL
  shadowRoot.appendChild(synonymCard);

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getSynonyms', word });
    if (!resp || !synonymCard) return;

    let html = `<div style="font-weight:600;font-size:13px;color:#0f766e;margin-bottom:6px">✦ ${escHtml(word)}</div>`;

    if (resp.definitions && resp.definitions.length) {
      html += '<div style="margin-bottom:6px"><span style="font-size:10px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Definition</span>';
      for (const d of resp.definitions.slice(0, 2)) {
        html += `<div style="font-size:12px;color:#718096"><em style="color:#0f766e;font-style:normal">${escHtml(d.pos)}</em> ${escHtml(d.definition)}</div>`;
      }
      html += '</div>';
    }

    if (resp.synonyms && resp.synonyms.length) {
      html += '<div style="margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Synonyms</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">';
      for (const s of resp.synonyms) {
        html += `<button class="yc-syn-word" data-word="${escHtml(s)}">${escHtml(s)}</button>`;
      }
      html += '</div></div>';
    }

    if (resp.antonyms && resp.antonyms.length) {
      html += '<div><span style="font-size:10px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Antonyms</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">';
      for (const a of resp.antonyms) {
        html += `<button class="yc-syn-word" data-word="${escHtml(a)}" style="border-style:dashed;color:#718096">${escHtml(a)}</button>`;
      }
      html += '</div></div>';
    }

    if ((!resp.synonyms || !resp.synonyms.length) && (!resp.antonyms || !resp.antonyms.length) && (!resp.definitions || !resp.definitions.length)) {
      html += '<div style="color:#718096;font-style:italic;font-size:12px">No results found</div>';
    }

    synonymCard.innerHTML = html;

    synonymCard.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.yc-syn-word');
      if (btn && activeField) {
        const replacement = btn.dataset.word;
        const txt = getFieldText();
        const pos = activeField.selectionStart || 0;
        const w = wordAtCursor(txt, pos);
        if (w.word) {
          const newText = txt.slice(0, w.start) + replacement + txt.slice(w.end);
          setFieldText(newText);
        }
        hideSynonymCard();
      }
    }, true);
  } catch {
    if (synonymCard) synonymCard.innerHTML = '<div style="color:#718096;font-size:12px">Could not load synonyms</div>';
  }
}

function hideSynonymCard() {
  if (synonymCard) {
    synonymCard.remove();
    synonymCard = null;
  }
}

function onDoubleClick(e) {
  if (!activeField) return;
  const text = getFieldText();
  if (!text) return;

  const pos = activeField.selectionStart || 0;
  const { word } = wordAtCursor(text, pos);
  if (!word || word.length < 2) return;

  const rect = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : { bottom: e.clientY + 10, left: e.clientX };
  showSynonyms(word, rect);
}

// ─── Field focus / blur ─────────────────────────────────────────
function activateField(field) {
  if (!field || field === activeField) return;
  activeField = field;
  currentMatches = [];
  hideFixCard();
  hideRewriteChip();
  showBadge(field);
  scheduleGrammarCheck();
  startPolling();
}

function deactivateField() {
  if (!activeField) return;
  activeField = null;
  hideBadge();
  hideToolbar();
  hideFixCard();
  hideRewriteChip();
  clearHighlights();
  removeHighlightsContainer();
  currentMatches = [];
  stopPolling();
}

function onFieldFocus(e) {
  const field = findEditable(e.target);
  if (!field) return;
  activateField(field);
}

function onFieldBlur(e) {
  const related = e.relatedTarget;
  if (related && related.closest && related.closest('#ycorrect-shadow-host')) return;
  setTimeout(() => {
    if (activeField && !activeField.contains(document.activeElement) &&
        document.activeElement !== activeField &&
        !activeField.matches(':focus-within')) {
      deactivateField();
    }
  }, 250);
}

// ─── Document-level input detection ─────────────────────────────
function onDocKeyActivity() {
  if (!activeField || !grammarEnabled) return;
  const target = document.activeElement;
  if (target && (activeField === target || activeField.contains(target))) {
    scheduleGrammarCheck();
  }
}

function onDocInput() {
  if (!activeField || !grammarEnabled) return;
  scheduleGrammarCheck();
}

// ─── Periodic polling ───────────────────────────────────────────
function startPolling() {
  stopPolling();
  lastPollText = getFieldText();
  pollTimer = setInterval(() => {
    if (!activeField || !grammarEnabled) { stopPolling(); return; }
    const newText = getFieldText();
    if (newText !== lastPollText) {
      lastPollText = newText;
      scheduleGrammarCheck();
    }
    // Re-sync highlights position (fields may resize/scroll)
    if (grammarEnabled && currentMatches.length > 0) {
      renderHighlights();
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Selection change ───────────────────────────────────────────
function onSelectionChange() {
  if (!activeField) return;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && activeField.contains(sel.anchorNode)) {
    showRewriteChip(sel);
  } else {
    hideRewriteChip();
  }
}

// ─── MutationObserver (SPA navigation) ──────────────────────────
let bodyObserver = null;

function setupObserver() {
  if (bodyObserver) return;
  bodyObserver = new MutationObserver(() => {
    if (activeField && !document.body.contains(activeField)) {
      deactivateField();
    }
    if (!activeField && document.activeElement) {
      const editable = findEditable(document.activeElement);
      if (editable) activateField(editable);
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
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

  // Capture-phase focusin catches events before React/ProseMirror handlers
  document.addEventListener('focusin', onFieldFocus, true);
  document.addEventListener('blur', onFieldBlur, true);

  // Document-level input detection (critical for ProseMirror/React)
  document.addEventListener('input', onDocInput, true);
  document.addEventListener('keydown', onDocKeyActivity, true);
  document.addEventListener('keyup', onDocKeyActivity, true);

  // Selection change (Rewrite chip)
  document.addEventListener('selectionchange', onSelectionChange);

  // Highlight click (underline → fix card)
  document.addEventListener('click', onHighlightClick);

  // Double-click synonyms
  document.addEventListener('dblclick', onDoubleClick);

  // Watch for SPA DOM changes
  setupObserver();

  // Detect current focus on init
  if (document.activeElement) {
    const editable = findEditable(document.activeElement);
    if (editable) activateField(editable);
  }
}

init();
