/**
 * WriteRight content script — core.
 *
 * Constants, state, shadow-DOM styles, shadow host, escaping, and field detection — the foundation every other part uses.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

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
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
].join(', ');

// Fields to skip — password inputs must never be read or rewritten by the
// writing assistant. Also skip any input whose autocomplete attribute signals
// a credential field (browser password managers, banking logins, etc.).
const SKIP_FIELDS = [
  'input[type="password"]',
  'input[type="number"]',
  'input[type="hidden"]',
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  'input[type="color"]',
  'input[type="range"]',
  'select',
  'textarea[readonly]',
  '[contenteditable="false"]',
];

function isSkipField(el) {
  if (!el) return false;
  // Explicit password/credential fields
  if (el.matches && el.matches('input[type="password"]')) return true;
  // Autocomplete attributes that signal sensitive credential fields
  const auto = (el.getAttribute && el.getAttribute('autocomplete') || '').toLowerCase();
  if (auto === 'current-password' || auto === 'new-password' ||
      auto === 'one-time-code' || auto === 'webauthn') return true;
  // Anything in the explicit skip list
  if (el.matches && el.matches(SKIP_FIELDS.join(', '))) return true;
  return false;
}

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
let sidebarEl = null;
let _lastCheckedText = '';

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
  #wr-sidebar{background:#1e293b;border-color:#334155;color:#e2e8f0}
  .wr-sb-issue{border-color:#334155}
  .wr-sb-issue:hover{background:#334155}
  .wr-sb-empty{color:#94a3b8}
}

/* Sidebar panel */
#wr-sidebar{
  position:fixed;top:0;right:0;width:380px;height:100vh;z-index:2147483647;
  pointer-events:auto;background:#fff;border-left:1px solid #e2e8f0;
  box-shadow:-4px 0 30px rgba(0,0,0,.15);display:none;
  font:13px/1.5 system-ui,-apple-system,sans-serif;color:#1a202c;
  animation:wrSlideIn .2s ease;overflow-y:auto;
}
@keyframes wrSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
.wr-sb-header{
  position:sticky;top:0;background:#fff;z-index:1;
  padding:16px;border-bottom:1px solid #e2e8f0;
  display:flex;align-items:center;justify-content:space-between;
}
.wr-sb-title{font-size:14px;font-weight:700;color:#059669}
.wr-sb-close{background:none;border:none;font-size:20px;cursor:pointer;color:#718096;padding:0 4px}
.wr-sb-close:hover{color:#1a202c}
.wr-sb-count{font-size:12px;color:#718096;margin-top:2px}
.wr-sb-body{padding:8px 16px 16px}
.wr-sb-empty{text-align:center;padding:40px 20px;color:#94a3b8}
.wr-sb-empty-icon{font-size:32px;margin-bottom:8px}
.wr-sb-issue{
  padding:12px;margin-bottom:8px;border-radius:8px;
  border:1px solid #e2e8f0;cursor:pointer;transition:background .1s;
}
.wr-sb-issue:hover{background:#f7fafc}
.wr-sb-issue-type{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#718096;margin-bottom:4px}
.wr-sb-issue-original{font-size:13px;color:#dc2626;text-decoration:line-through;margin-bottom:4px}
.wr-sb-issue-msg{font-size:12px;color:#64748b;margin-bottom:6px}
.wr-sb-issue-chips{display:flex;flex-wrap:wrap;gap:4px}
.wr-sb-chip{
  padding:4px 10px;border-radius:6px;border:1px solid #059669;
  background:#f0fdf4;cursor:pointer;font-size:12px;font-weight:500;
  color:#059669;transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-sb-chip:hover{background:#059669;color:#fff}
.wr-sb-fixall{
  padding:5px 12px;border-radius:6px;border:none;
  background:#059669;color:#fff;font-size:11px;font-weight:600;
  cursor:pointer;transition:all .1s;
  font-family:system-ui,-apple-system,sans-serif;
}
.wr-sb-fixall:hover{background:#047857}
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
  // Listen for clicks inside Shadow DOM (highlight clicks, chips, etc.)
  shadowRoot.addEventListener('click', onHighlightClick);
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

  // Skip password/credential fields entirely
  if (isSkipField(el)) return null;

  if (el.matches && el.matches(FIELD_SELECTOR)) return el;
  if (el.isContentEditable) return el;

  let cur = el;
  for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
    if (isSkipField(cur)) return null;
    if (cur.isContentEditable) return cur;
    if (cur.matches && cur.matches(FIELD_SELECTOR)) return cur;
    cur = cur.parentElement;
  }

  if (el.querySelector) {
    const child = el.querySelector(FIELD_SELECTOR);
    if (child && child.isContentEditable && !isSkipField(child)) return child;
  }

  return null;
}

