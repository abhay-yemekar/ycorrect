/**
 * WriteRight content script — events.
 *
 * Field focus/blur wiring, polling, selection handling, observer, site gating, and init.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

// ─── Field focus / blur ─────────────────────────────────────────
let scrollListeners = [];

function addScrollListeners(field) {
  removeScrollListeners();
  let cur = field?.parentElement;
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur);
    if (style.overflow === 'auto' || style.overflow === 'scroll' ||
        style.overflowY === 'auto' || style.overflowY === 'scroll' ||
        style.overflowX === 'auto' || style.overflowX === 'scroll') {
      const handler = () => { if (currentMatches.length > 0) renderHighlights(); };
      cur.addEventListener('scroll', handler, { passive: true });
      scrollListeners.push({ el: cur, handler });
    }
    cur = cur.parentElement;
  }
}

function removeScrollListeners() {
  for (const { el, handler } of scrollListeners) {
    el.removeEventListener('scroll', handler);
  }
  scrollListeners = [];
}

function activateField(field) {
  if (!field || field === activeField) return;
  activeField = field;
  currentMatches = [];
  hideFixCard();
  hideRewriteChip();
  showBadge(field);
  addScrollListeners(field);
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
  removeScrollListeners();
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

let scrollRaf = null;
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    if (currentMatches.length > 0 && activeField) renderHighlights();
  });
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
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeyDown, true);
  // Double-click synonyms disabled — was showing unwanted popup in top-left corner
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  setupObserver();

  if (document.activeElement) {
    const editable = findEditable(document.activeElement);
    if (editable) activateField(editable);
  }
}

// --- Loading spinner ---
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

// --- Sidebar panel ---
function toggleSidebar() {
  if (sidebarEl && sidebarEl.style.display !== 'none') {
    hideSidebar();
  } else {
    showSidebar();
  }
}

function showSidebar() {
  ensureShadowHost();
  if (!sidebarEl) {
    sidebarEl = document.createElement('div');
    sidebarEl.id = 'wr-sidebar';
    shadowRoot.appendChild(sidebarEl);
  }
  renderSidebar();
  sidebarEl.style.display = 'block';
}

function hideSidebar() {
  if (sidebarEl) sidebarEl.style.display = 'none';
}

function renderSidebar() {
  if (!sidebarEl) return;
  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));

  let html = '<div class="wr-sb-header">' +
    '<div><div class="wr-sb-title">\u2726 WriteRight</div>' +
    '<div class="wr-sb-count">' + visible.length + ' issue' + (visible.length !== 1 ? 's' : '') + ' found</div></div>' +
    '<div style="display:flex;gap:6px;align-items:center">' +
    (visible.length > 0 ? '<button class="wr-sb-fixall" id="wr-sb-fixall">Fix All</button>' : '') +
    '<button class="wr-sb-close" id="wr-sb-close">\u00d7</button>' +
    '</div></div>';

  html += '<div class="wr-sb-body">';

  if (visible.length === 0) {
    html += '<div class="wr-sb-empty"><div class="wr-sb-empty-icon">\u2713</div>' +
      '<div>No issues found</div></div>';
  } else {
    for (let i = 0; i < visible.length; i++) {
      const m = visible[i];
      const text = getFieldText();
      const original = text.slice(m.offset, m.offset + m.length);
      const repls = (m.replacements || []).slice(0, 4);
      const cat = m.rule?.category?.name || 'Writing';
      const type = m.rule?.issueType || 'issue';

      html += '<div class="wr-sb-issue" data-idx="' + i + '">';
      html += '<div class="wr-sb-issue-type">' + escHtml(cat) + ' \u00b7 ' + escHtml(type) + '</div>';
      html += '<div class="wr-sb-issue-original">' + escHtml(original) + '</div>';
      html += '<div class="wr-sb-issue-msg">' + escHtml(m.message || 'Improve this text') + '</div>';

      if (repls.length > 0) {
        html += '<div class="wr-sb-issue-chips">';
        for (const r of repls) {
          html += '<button class="wr-sb-chip" data-idx="' + i + '" data-replace="' + escHtml(r.value) + '">' + escHtml(r.value) + '</button>';
        }
        html += '</div>';
      }

      html += '</div>';
    }
  }

  html += '</div>';
  sidebarEl.innerHTML = html;

  // Wire up close button
  sidebarEl.querySelector('#wr-sb-close').addEventListener('click', hideSidebar);

  // Wire up Fix All button
  const fixAllBtn = sidebarEl.querySelector('#wr-sb-fixall');
  if (fixAllBtn) {
    fixAllBtn.addEventListener('click', () => {
      const eligible = visible.filter(m => m.replacements && m.replacements.length > 0);
      if (eligible.length === 0) return;
      // Sort descending by offset so replacements don't shift earlier positions
      eligible.sort((a, b) => b.offset - a.offset);
      for (const m of eligible) {
        replaceMatch(m, m.replacements[0].value);
      }
      showToast('Fixed ' + eligible.length + ' issue' + (eligible.length > 1 ? 's' : ''), 'success');
    });
  }

  // Wire up chip clicks
  sidebarEl.querySelectorAll('.wr-sb-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(chip.dataset.idx, 10);
      const replacement = chip.dataset.replace;
      if (replacement && visible[idx]) {
        replaceMatch(visible[idx], replacement);
        renderSidebar();
      }
    });
  });

  // Wire up issue clicks (jump to text)
  sidebarEl.querySelectorAll('.wr-sb-issue').forEach(issue => {
    issue.addEventListener('click', () => {
      const idx = parseInt(issue.dataset.idx, 10);
      if (visible[idx]) {
        const rect = issue.getBoundingClientRect();
        showFixCard(visible[idx], rect);
      }
    });
  });
}

init();
