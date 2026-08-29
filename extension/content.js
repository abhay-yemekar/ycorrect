/**
 * WriteRight content script — in-page writing assistant.
 *
 * Detects text fields (textarea, input, contenteditable, role="textbox"),
 * shows a floating badge on focus, runs grammar checks via the background
 * worker, renders underline highlights, and offers click-to-fix cards
 * and selection-based AI rewrite with mode chips.
 *
 * All UI lives inside a Shadow DOM so host-page CSS cannot clash.
 * Uses pointerdown (not click) for badge to avoid SPA event interception.
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
let grammarSpinnerEl = null;
let toastTimer = null;

// ─── Shadow DOM styles ─────────────────────────────────────────
const STYLES = `
/* Badge */
#wr-badge{
  position:fixed;z-index:2147483647;
  pointer-events:auto!important;cursor:pointer;display:none;
}
.wr-badge-inner{
  width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#10b981,#059669);
  border:3px solid rgba(255,255,255,0.95);
  box-shadow:0 4px 20px rgba(0,0,0,.4);
  display:flex;align-items:center;justify-content:center;
  font-size:20px;color:#fff;font-weight:400;
  font-family:system-ui,-apple-system,sans-serif;
  transition:transform .15s,box-shadow .15s;
  user-select:none;
}
.wr-badge-inner:hover{
  transform:scale(1.15);
  box-shadow:0 6px 24px rgba(16,185,129,.6);
}
.wr-badge-count{
  position:absolute;top:-6px;right:-6px;
  background:#ef4444;color:#fff;font-size:11px;font-weight:700;
  border-radius:50%;min-width:18px;height:18px;
  display:flex;align-items:center;justify-content:center;
  border:2px solid #fff;
  font-family:system-ui,-apple-system,sans-serif;
  pointer-events:none;
}

/* Toolbar */
#wr-toolbar{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.15),0 2px 8px rgba(0,0,0,.08);
  padding:12px 14px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:400px;color:#1a202c;
  animation:wrFadeIn .15s ease;
}
@keyframes wrFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.wr-toolbar-title{
  font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  color:#059669;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;
  display:flex;align-items:center;gap:6px;
}
.wr-toolbar-row{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
.wr-toolbar-row:last-child{margin-bottom:0}
.wr-mode{
  padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;
  background:#f7fafc;cursor:pointer;font-size:12px;
  transition:all .1s;color:#1a202c;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-mode:hover{background:#edf2f7}
.wr-mode.active{background:#059669;color:#fff;border-color:#059669}
.wr-action{
  padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:12px;color:#1a202c;
  transition:background .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-action:hover{background:#edf2f7}
.wr-toolbar-info{
  font-size:11px;color:#718096;justify-content:space-between;
  align-items:center;border-top:1px solid #e2e8f0;padding-top:8px;
  display:flex;gap:6px;
}
.wr-issue-count{font-weight:600;color:#059669}
.wr-toggle{
  padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:11px;color:#1a202c;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-link{
  padding:4px 10px;border-radius:6px;border:none;background:none;
  cursor:pointer;font-size:11px;color:#059669;text-decoration:underline;
  font-family:system-ui,-apple-system,sans-serif;
}

/* Fix card */
#wr-fix-card{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);
  padding:14px 16px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  min-width:240px;max-width:360px;color:#1a202c;
  animation:wrFadeIn .15s ease;
}
.wr-fix-header{
  font-size:11px;text-transform:uppercase;letter-spacing:.05em;
  color:#718096;margin-bottom:8px;font-weight:600;
}
.wr-fix-original{
  font-size:13px;color:#94a3b8;text-decoration:line-through;margin-bottom:8px;
}
.wr-fix-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.wr-fix-chip{
  padding:6px 12px;border-radius:8px;border:1.5px solid #059669;
  background:#f0fdf4;cursor:pointer;font-size:14px;font-weight:500;
  color:#059669;transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-fix-chip:hover{background:#059669;color:#fff}
.wr-fix-msg{font-size:12px;color:#64748b;margin-bottom:10px;line-height:1.5}
.wr-fix-actions{display:flex;gap:8px}
.wr-fix-btn{
  padding:6px 16px;border-radius:8px;border:1px solid #e2e8f0;
  background:#fff;cursor:pointer;font-size:12px;color:#1a202c;
  transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-fix-btn:hover{background:#edf2f7}
.wr-fix-btn.primary{background:#059669;color:#fff;border-color:#059669}
.wr-fix-btn.primary:hover{background:#047857}

/* Rewrite chip */
#wr-rewrite-chip{
  position:fixed;z-index:2147483647;pointer-events:auto;display:none;
}
.wr-rewrite-btn{
  padding:8px 16px;border-radius:10px;border:none;
  background:linear-gradient(135deg,#10b981,#059669);
  color:#fff;font-size:14px;font-weight:600;cursor:pointer;
  box-shadow:0 4px 16px rgba(5,150,105,.45);
  font-family:system-ui,-apple-system,sans-serif;
  transition:transform .1s;
  animation:wrFadeIn .12s ease;
}
.wr-rewrite-btn:hover{transform:scale(1.05)}

/* Rewrite result */
#wr-rewrite-result{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.18);
  padding:14px 16px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:380px;color:#1a202c;
  animation:wrFadeIn .15s ease;
}
.wr-rewrite-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#059669;margin-bottom:8px}
.wr-rewrite-suggestion{
  font-size:14px;line-height:1.6;padding:12px 14px;
  background:#f0fdf4;border-radius:8px;border-left:3px solid #059669;
  margin-bottom:10px;white-space:pre-wrap;word-break:break-word;
  max-height:200px;overflow-y:auto;
}
.wr-rewrite-actions{display:flex;gap:8px}

/* Underline highlights */
.wr-highlight{
  position:fixed;pointer-events:auto;cursor:pointer;
  background:transparent;border-bottom:2.5px wavy #dc2626;
  border-radius:1px;transition:background .1s;
}
.wr-highlight:hover{background:rgba(220,38,38,.12)}
.wr-highlight[data-issue-type="misspelling"]{border-bottom-color:#dc2626}
.wr-highlight[data-issue-type="grammar"]{border-bottom-color:#dc2626}
.wr-highlight[data-issue-type="clarity"]{border-bottom-color:#2563eb}
.wr-highlight[data-issue-type="style"]{border-bottom-color:#ca8a04}
.wr-highlight[data-issue-type="other"]{border-bottom-color:#dc2626}

/* Synonym card */
#wr-synonym-card{
  position:fixed;z-index:2147483647;pointer-events:auto;
  background:#fff;border:1px solid #e2e8f0;border-radius:12px;
  box-shadow:0 8px 30px rgba(0,0,0,.18);
  padding:14px 16px;display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;
  max-width:320px;min-width:200px;color:#1a202c;
  animation:wrFadeIn .15s ease;
}
.wr-syn-word{
  padding:4px 10px;border-radius:6px;border:1px solid #e2e8f0;
  background:#f7fafc;cursor:pointer;font-size:13px;color:#1a202c;
  transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-syn-word:hover{background:#059669!important;color:#fff!important;border-color:#059669!important}


/* Loading spinner */
.wr-spinner{
  position:fixed;z-index:2147483647;pointer-events:none;
  top:6px;right:6px;width:20px;height:20px;
  border:2.5px solid rgba(5,150,105,.25);border-top-color:#059669;
  border-radius:50%;animation:wrSpin .7s linear infinite;
}
@keyframes wrSpin{to{transform:rotate(360deg)}}

/* Error toast */
.wr-toast{
  position:fixed;z-index:2147483647;pointer-events:auto;
  bottom:20px;right:20px;
  background:#1e293b;color:#f8fafc;border-radius:10px;
  padding:12px 20px;font:13px/1.5 system-ui,-apple-system,sans-serif;
  box-shadow:0 8px 30px rgba(0,0,0,.3);
  display:flex;align-items:center;gap:10px;
  animation:wrToastIn .2s ease;
  max-width:360px;
}
.wr-toast-error{border-left:4px solid #ef4444}
.wr-toast-success{border-left:4px solid #10b981}
.wr-toast-dismiss{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 4px;line-height:1}
.wr-toast-dismiss:hover{color:#fff}
@keyframes wrToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
/* Dark mode */
@media(prefers-color-scheme:dark){
  #wr-toolbar,#wr-fix-card,#wr-rewrite-result,#wr-synonym-card{
    background:#1e293b;border-color:#334155;color:#e2e8f0;
  }
  .wr-mode,.wr-action,.wr-toggle{
    background:#334155;color:#e2e8f0;border-color:#475569;
  }
  .wr-mode:hover,.wr-action:hover{background:#475569}
  .wr-mode.active{background:#059669;color:#fff;border-color:#059669}
  .wr-fix-btn{background:#334155;color:#e2e8f0;border-color:#475569}
  .wr-fix-btn:hover{background:#475569}
  .wr-fix-chip{background:#1e293b;color:#34d399;border-color:#059669}
  .wr-fix-chip:hover{background:#059669;color:#fff}
  .wr-rewrite-suggestion{background:#1e293b;color:#34d399}
  .wr-link{color:#34d399}
  .wr-highlight:hover{background:rgba(220,38,38,.15)}
  .wr-synonym-card{background:#1e293b;border-color:#334155;color:#e2e8f0}
  .wr-syn-word{background:#334155;color:#e2e8f0;border-color:#475569}
  .wr-toolbar-title{color:#34d399;border-bottom-color:#334155}
}
`;

let shadowRoot = null;
let siteEnabled = true;
let grammarEnabled = true;

// ─── Shadow host ────────────────────────────────────────────────
function ensureShadowHost() {
  if (shadowRoot) return shadowRoot.host;
  const host = document.createElement('div');
  host.id = 'writeright-shadow-host';
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
  if (el.closest && el.closest('#writeright-shadow-host')) return null;
  if (el.shadowRoot) return null;

  if (el.matches && el.matches(FIELD_SELECTOR)) return el;
  if (el.isContentEditable) return el;

  let cur = el;
  for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
    if (cur.isContentEditable) return cur;
    if (cur.matches && cur.matches(FIELD_SELECTOR)) return cur;
    cur = cur.parentElement;
  }

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
    badgeEl.id = 'wr-badge';
    badgeEl.innerHTML = '<div class="wr-badge-inner" title="WriteRight \u2014 click for writing tools">\u2713</div>';
    badgeEl.addEventListener('pointerdown', onBadgePointerDown, true);
    shadowRoot.appendChild(badgeEl);
  }
  positionBadge(field);
  badgeEl.style.display = 'block';
}

function hideBadge() {
  if (badgeEl) badgeEl.style.display = 'none';
}

function positionBadge(field) {
  if (!badgeEl || !field) return;
  const r = field.getBoundingClientRect();
  const top = Math.max(6, r.top - 46);
  const left = Math.min(r.right - 46, window.innerWidth - 50);
  badgeEl.style.top = `${top}px`;
  badgeEl.style.left = `${Math.max(6, left)}px`;
}

function updateBadgeCount() {
  if (!badgeEl) return;
  const count = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message)).length;
  const existing = badgeEl.querySelector('.wr-badge-count');
  if (count > 0) {
    if (!existing) {
      const dot = document.createElement('div');
      dot.className = 'wr-badge-count';
      badgeEl.appendChild(dot);
    }
    badgeEl.querySelector('.wr-badge-count').textContent = count > 9 ? '9+' : String(count);
  } else if (existing) {
    existing.remove();
  }
}

// ─── Badge pointerdown -> toggle toolbar ────────────────────────
function onBadgePointerDown(e) {
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
    toolbarEl.id = 'wr-toolbar';
    toolbarEl.innerHTML = `
      <div class="wr-toolbar-title">\u2726 WriteRight</div>
      <div class="wr-toolbar-row">
        <button class="wr-mode active" data-mode="Humanize">\u2728 Humanize</button>
        <button class="wr-mode" data-mode="Fluency">\uD83D\uDCD6 Fluency</button>
        <button class="wr-mode" data-mode="Formal">\uD83D\uDC54 Formal</button>
        <button class="wr-mode" data-mode="Shorten">\u2702\uFE0F Shorten</button>
        <button class="wr-mode" data-mode="Expand">\uD83D\uDCDD Expand</button>
        <button class="wr-mode" data-mode="Creative">\uD83C\uDFA8 Creative</button>
      </div>
      <div class="wr-toolbar-row">
        <button class="wr-action" id="wr-check">\u2713 Check grammar</button>
        <button class="wr-action" id="wr-rewrite">\u2726 Rewrite selection</button>
      </div>
      <div class="wr-toolbar-row wr-toolbar-info">
        <span class="wr-issue-count" id="wr-issue-count"></span>
        <button class="wr-toggle" id="wr-grammar-toggle">Grammar: ON</button>
        <button class="wr-link" id="wr-open-app">Open WriteRight</button>
      </div>`;
    toolbarEl.addEventListener('click', onToolbarClick, true);
    shadowRoot.appendChild(toolbarEl);
  }
  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    toolbarEl.style.top = `${br.bottom + 10}px`;
    toolbarEl.style.left = `${Math.max(6, br.left - 80)}px`;
    const toolbarRight = br.left - 80 + 400;
    if (toolbarRight > window.innerWidth) {
      toolbarEl.style.left = `${Math.max(6, window.innerWidth - 406)}px`;
    }
  } else {
    toolbarEl.style.top = '60px';
    toolbarEl.style.left = '50%';
    toolbarEl.style.transform = 'translateX(-50%)';
  }
  toolbarEl.style.display = 'block';
  updateIssueCount();
  updateGrammarToggle();
}

function hideToolbar() {
  if (toolbarEl) toolbarEl.style.display = 'none';
}

function onToolbarClick(e) {
  const modeBtn = e.target.closest('.wr-mode');
  if (modeBtn) {
    toolbarEl.querySelectorAll('.wr-mode').forEach(b => b.classList.remove('active'));
    modeBtn.classList.add('active');
    return;
  }
  const action = e.target.id;
  if (action === 'wr-check') {
    runGrammarCheck(true);
    hideToolbar();
  } else if (action === 'wr-rewrite') {
    rewriteSelection(getActiveMode());
    hideToolbar();
  } else if (action === 'wr-grammar-toggle') {
    grammarEnabled = !grammarEnabled;
    updateGrammarToggle();
    if (!grammarEnabled) clearHighlights();
  } else if (action === 'wr-open-app') {
    chrome.runtime.sendMessage({ type: 'openApp' });
  }
}

function getActiveMode() {
  const active = toolbarEl?.querySelector('.wr-mode.active');
  return active?.dataset?.mode || 'Humanize';
}

function updateIssueCount() {
  const count = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message)).length;
  const el = toolbarEl?.querySelector('#wr-issue-count');
  if (el) el.textContent = count > 0 ? `${count} issue${count !== 1 ? 's' : ''} found` : 'No issues found';
}

function updateGrammarToggle() {
  const btn = toolbarEl?.querySelector('#wr-grammar-toggle');
  if (btn) btn.textContent = `Grammar: ${grammarEnabled ? 'ON' : 'OFF'}`;
}

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
  return activeField.innerText || activeField.textContent || '';
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

// ─── Underline highlights (text-search approach) ────────────────
// Instead of using offset-based char maps (which break when innerText
// and text nodes disagree on newlines), we search for the error text
// directly in DOM text nodes. This is more robust on ProseMirror.

function createHighlightsContainer() {
  if (highlightsContainer && document.body.contains(highlightsContainer)) return;
  highlightsContainer = document.createElement('div');
  highlightsContainer.id = 'wr-highlights';
  highlightsContainer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;overflow:visible;';
  document.body.appendChild(highlightsContainer);
}

function removeHighlightsContainer() {
  if (highlightsContainer) { highlightsContainer.remove(); highlightsContainer = null; }
}

function clearHighlights() {
  if (highlightsContainer) highlightsContainer.innerHTML = '';
}

/**
 * Collect all text nodes in a field, returning them with their cumulative
 * character positions. We also track block-level gaps (newlines) that
 * innerText would include but text nodes don't.
 */
function collectTextNodes(field) {
  const nodes = [];
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    if (text.length > 0) {
      nodes.push({ node, text, length: text.length });
    }
  }
  return nodes;
}

/**
 * Build a "innerText-like" string from text nodes + block gaps,
 * and a map from each character in that string to its DOM position.
 *
 * We detect block gaps by checking if consecutive text nodes are in
 * different block elements (p, div, li, etc.).
 */
function buildAlignedTextMap(field) {
  const nodes = collectTextNodes(field);
  if (nodes.length === 0) return { text: '', charMap: [] };

  const charMap = [];
  let text = '';

  for (let i = 0; i < nodes.length; i++) {
    const { node, length } = nodes[i];

    // Add a newline gap if this node is in a different block than the previous
    if (i > 0) {
      const prevParent = getBlockParent(nodes[i - 1].node);
      const curParent = getBlockParent(node);
      if (prevParent !== curParent) {
        text += '\n';
        charMap.push({ node, offset: 0, isGap: true });
      }
    }

    for (let j = 0; j < length; j++) {
      text += node.textContent[j];
      charMap.push({ node, offset: j });
    }
  }

  return { text, charMap };
}

/**
 * Get the nearest block-level ancestor (p, div, li, h1-h6, td, etc.)
 */
function getBlockParent(node) {
  let cur = node.parentElement;
  while (cur && cur !== activeField) {
    const tag = cur.tagName;
    if (tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'H1' ||
        tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' ||
        tag === 'H6' || tag === 'TD' || tag === 'TH' || tag === 'BLOCKQUOTE') {
      return cur;
    }
    cur = cur.parentElement;
  }
  return activeField;
}

/**
 * Create a Range from charMap positions.
 */
function rangeFromCharMap(charMap, startIdx, length) {
  if (startIdx < 0 || startIdx + length > charMap.length) return null;

  // Find first non-gap char
  let startEntry = null;
  for (let i = startIdx; i < startIdx + length; i++) {
    if (!charMap[i].isGap) { startEntry = charMap[i]; break; }
  }
  // Find last non-gap char
  let endEntry = null;
  for (let i = startIdx + length - 1; i >= startIdx; i--) {
    if (!charMap[i].isGap) { endEntry = charMap[i]; break; }
  }

  if (!startEntry || !endEntry) return null;

  const range = document.createRange();
  range.setStart(startEntry.node, startEntry.offset);
  range.setEnd(endEntry.node, endEntry.offset + 1);
  return range;
}

function renderHighlights() {
  clearHighlights();
  if (!activeField) return;

  // Textareas and inputs: use a simple overlay approach
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    renderTextareaHighlights();
    return;
  }

  createHighlightsContainer();

  const { text: alignedText, charMap } = buildAlignedTextMap(activeField);
  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));

  for (const match of visible) {
    const searchText = alignedText.slice(match.offset, match.offset + match.length);
    if (!searchText) continue;

    // Find this text in the aligned text (handle potential duplicates)
    const foundIdx = alignedText.indexOf(searchText, 0);
    if (foundIdx === -1) continue;

    const range = rangeFromCharMap(charMap, foundIdx, searchText.length);
    if (!range) continue;

    const rects = range.getClientRects();
    if (!rects || rects.length === 0) continue;

    const issueType = match.rule?.issueType || 'other';

    for (const rect of rects) {
      if (rect.width < 2) continue;

      const hl = document.createElement('div');
      hl.className = 'wr-highlight';
      hl.dataset.issueType = issueType;
      hl.dataset.matchOffset = String(match.offset);
      hl.dataset.matchLength = String(match.length);
      hl.style.position = 'fixed';
      hl.style.left = `${rect.left}px`;
      hl.style.top = `${rect.top + rect.height - 4}px`;
      hl.style.width = `${rect.width}px`;
      hl.style.height = '3px';
      hl.style.pointerEvents = 'auto';
      highlightsContainer.appendChild(hl);
    }

    range.detach();
  }
}

/**
 * For textarea/input fields, render underlines by overlaying
 * a transparent mirror of the text to find character positions.
 */
function renderTextareaHighlights() {
  createHighlightsContainer();
  const field = activeField;
  const text = field.value;
  const style = window.getComputedStyle(field);
  const rect = field.getBoundingClientRect();

  // Create a mirror element to measure text positions
  const mirror = document.createElement('div');
  mirror.style.cssText = `
    position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;
    overflow:hidden;font:${style.font} ${style.fontSize}/${style.lineHeight} ${style.fontFamily};
    padding:${style.padding};border:${style.border};width:${field.clientWidth}px;
  `;
  document.body.appendChild(mirror);

  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));

  for (const match of visible) {
    const searchText = text.slice(match.offset, match.offset + match.length);
    if (!searchText) continue;

    // Measure position of the error text
    mirror.textContent = text.slice(0, match.offset);
    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = searchText;
    mirror.appendChild(beforeSpan);
    const afterText = document.createTextNode(text.slice(match.offset + match.length));
    mirror.appendChild(afterText);

    const spanRect = beforeSpan.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    if (spanRect.width > 0) {
      const hl = document.createElement('div');
      hl.className = 'wr-highlight';
      hl.dataset.issueType = match.rule?.issueType || 'other';
      hl.dataset.matchOffset = String(match.offset);
      hl.dataset.matchLength = String(match.length);
      hl.style.position = 'fixed';
      hl.style.left = `${rect.left + spanRect.left - mirrorRect.left}px`;
      hl.style.top = `${rect.top + spanRect.top - mirrorRect.top + spanRect.height - 4}px`;
      hl.style.width = `${spanRect.width}px`;
      hl.style.height = '3px';
      hl.style.pointerEvents = 'auto';
      highlightsContainer.appendChild(hl);
    }

    mirror.textContent = '';
  }

  mirror.remove();
}

function onHighlightClick(e) {
  const hl = e.target.closest('.wr-highlight');
  if (!hl) { hideFixCard(); return; }
  const offset = parseInt(hl.dataset.matchOffset, 10);
  const match = currentMatches.find(m => m.offset === offset);
  if (!match) return;
  const rect = hl.getBoundingClientRect();
  showFixCard(match, rect);
}

// ─── Grammar check ──────────────────────────────────────────────
async function runGrammarCheck() {
  showSpinner();
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
    showToast("Could not reach WriteRight server. Make sure npm start is running.", "error");
  } finally {
    hideSpinner();
  }
}

function scheduleGrammarCheck() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (grammarEnabled && activeField) runGrammarCheck();
  }, DEBOUNCE_MS);
}

// ─── AI rewrite ────────────────────────────────────────────────
async function rewriteSelection(mode) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const selectedText = sel.toString().trim();
  if (!selectedText || selectedText.length < 3) return;
  hideRewriteChip();

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'rewrite', text: selectedText, mode });
    if (resp && resp.suggestion) showRewriteResult(selectedText, resp.suggestion, mode);
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
      setFieldText(text.slice(0, sentStart) + resp.suggestion + text.slice(sentEnd));
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runGrammarCheck(), 300);
    }
  } catch { /* Server unreachable */ }
}

function showRewriteResult(_original, suggestion, mode) {
  ensureShadowHost();
  const card = document.createElement('div');
  card.id = 'wr-rewrite-result';
  card.innerHTML = `
    <div class="wr-rewrite-header">\u2726 ${escHtml(mode)} rewrite</div>
    <div class="wr-rewrite-suggestion">${escHtml(suggestion)}</div>
    <div class="wr-rewrite-actions">
      <button class="wr-fix-btn primary" data-action="replace">Replace</button>
      <button class="wr-fix-btn" data-action="copy">Copy</button>
      <button class="wr-fix-btn" data-action="dismiss">Dismiss</button>
    </div>`;

  if (badgeEl) {
    const br = badgeEl.getBoundingClientRect();
    card.style.top = `${br.bottom + 10}px`;
    card.style.left = `${Math.max(6, br.left - 100)}px`;
  } else {
    card.style.top = '80px';
    card.style.left = '50%';
    card.style.transform = 'translateX(-50%)';
  }
  card.style.display = 'block';
  shadowRoot.appendChild(card);

  card.addEventListener('click', async (e) => {
    const action = e.target.dataset?.action;
    if (action === 'replace') {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) replaceSelection(sel.toString(), suggestion);
      card.remove();
    } else if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(suggestion);
        e.target.textContent = '\u2713 Copied';
      } catch { e.target.textContent = 'Copy failed'; }
    } else if (action === 'dismiss') {
      card.remove();
    }
  }, true);
}

// ─── Synonyms ──────────────────────────────────────────────────
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
  synonymCard.id = 'wr-synonym-card';
  synonymCard.innerHTML = '<div style="padding:10px;color:#718096;font-size:13px">Loading synonyms\u2026</div>';
  const top = anchorRect.bottom + 8;
  const left = Math.max(6, Math.min(anchorRect.left, window.innerWidth - 320));
  synonymCard.style.top = `${top}px`;
  synonymCard.style.left = `${left}px`;
  synonymCard.style.display = 'block';
  shadowRoot.appendChild(synonymCard);

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'getSynonyms', word });
    if (!resp || !synonymCard) return;

    let html = `<div style="font-weight:600;font-size:14px;color:#059669;margin-bottom:8px">\u2726 ${escHtml(word)}</div>`;

    if (resp.definitions && resp.definitions.length) {
      html += '<div style="margin-bottom:8px"><span style="font-size:11px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Definition</span>';
      for (const d of resp.definitions.slice(0, 2)) {
        html += `<div style="font-size:13px;color:#718096"><em style="color:#059669;font-style:normal">${escHtml(d.pos)}</em> ${escHtml(d.definition)}</div>`;
      }
      html += '</div>';
    }

    if (resp.synonyms && resp.synonyms.length) {
      html += '<div style="margin-bottom:6px"><span style="font-size:11px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Synonyms</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">';
      for (const s of resp.synonyms) html += `<button class="wr-syn-word" data-word="${escHtml(s)}">${escHtml(s)}</button>`;
      html += '</div></div>';
    }

    if (resp.antonyms && resp.antonyms.length) {
      html += '<div><span style="font-size:11px;text-transform:uppercase;color:#718096;letter-spacing:.04em">Antonyms</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">';
      for (const a of resp.antonyms) html += `<button class="wr-syn-word" data-word="${escHtml(a)}" style="border-style:dashed;color:#718096">${escHtml(a)}</button>`;
      html += '</div></div>';
    }

    if ((!resp.synonyms || !resp.synonyms.length) && (!resp.antonyms || !resp.antonyms.length) && (!resp.definitions || !resp.definitions.length)) {
      html += '<div style="color:#718096;font-style:italic;font-size:13px">No results found</div>';
    }

    synonymCard.innerHTML = html;
    synonymCard.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.wr-syn-word');
      if (btn && activeField) {
        const replacement = btn.dataset.word;
        const txt = getFieldText();
        const pos = activeField.selectionStart || 0;
        const w = wordAtCursor(txt, pos);
        if (w.word) setFieldText(txt.slice(0, w.start) + replacement + txt.slice(w.end));
        hideSynonymCard();
      }
    }, true);
  } catch {
    if (synonymCard) synonymCard.innerHTML = '<div style="color:#718096;font-size:13px">Could not load synonyms</div>';
  }
}

function hideSynonymCard() {
  if (synonymCard) { synonymCard.remove(); synonymCard = null; }
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
  if (related && related.closest && related.closest('#writeright-shadow-host')) return;
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

// ─── Polling ────────────────────────────────────────────────────
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
    if (grammarEnabled && currentMatches.length > 0) renderHighlights();
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
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

// ─── MutationObserver ───────────────────────────────────────────
let bodyObserver = null;

function setupObserver() {
  if (bodyObserver) return;
  bodyObserver = new MutationObserver(() => {
    if (activeField && !document.body.contains(activeField)) deactivateField();
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
    siteEnabled = !data.disabledSites.includes(location.hostname);
    grammarEnabled = data.grammarEnabled !== false;
  } catch { siteEnabled = true; }
}

// ─── Window resize handler ──────────────────────────────────────
function onResize() {
  if (currentMatches.length > 0 && activeField) renderHighlights();
}

// ─── Init ───────────────────────────────────────────────────────
// --- Keyboard shortcuts ---
function onKeyDown(e) {
  if (e.key === "Escape") {
    hideToolbar();
    hideFixCard();
    hideRewriteChip();
    hideSynonymCard();
  }
}

async function init() {
  await checkSiteEnabled();
  if (!siteEnabled) return;

  document.addEventListener('focusin', onFieldFocus, true);
  document.addEventListener('blur', onFieldBlur, true);
  document.addEventListener('input', onDocInput, true);
  document.addEventListener('keydown', onDocKeyActivity, true);
  document.addEventListener('keyup', onDocKeyActivity, true);
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('click', onHighlightClick);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('dblclick', onDoubleClick);
  window.addEventListener('resize', onResize);
  setupObserver();

  if (document.activeElement) {
    const editable = findEditable(document.activeElement);
    if (editable) activateField(editable);
  }
}

init();// --- Loading spinner ---
function showSpinner() {
  ensureShadowHost();
  if (!grammarSpinnerEl) {
    grammarSpinnerEl = document.createElement("div");
    grammarSpinnerEl.className = "wr-spinner";
    shadowRoot.appendChild(grammarSpinnerEl);
  }
  grammarSpinnerEl.style.display = "block";
}
function hideSpinner() {
  if (grammarSpinnerEl) grammarSpinnerEl.style.display = "none";
}

// --- Error toast ---
function showToast(msg, type) {
  ensureShadowHost();
  const existing = shadowRoot.querySelector(".wr-toast");
  if (existing) existing.remove();
  clearTimeout(toastTimer);
  const toast = document.createElement("div");
  toast.className = "wr-toast wr-toast-" + (type || "error");
  toast.innerHTML = "<span>" + msg + "</span>" + '<button class="wr-toast-dismiss">×</button>';
  shadowRoot.appendChild(toast);
  toast.querySelector(".wr-toast-dismiss").addEventListener("click", () => toast.remove());
  toastTimer = setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}


