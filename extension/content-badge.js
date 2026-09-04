/**
 * WriteRight content script — badge.
 *
 * The floating badge and the toolbar it toggles, plus active-mode and issue-count helpers.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

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
  // Click badge → toggle sidebar directly with all issues and fix buttons
  if (sidebarEl && sidebarEl.style.display !== 'none') {
    hideSidebar();
  } else {
    showSidebar();
  }
}

function _showToolbar() {
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
        <button class="wr-action" id="wr-sidebar-toggle">\u2630 Issues</button>
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
  } else if (action === 'wr-sidebar-toggle') {
    toggleSidebar();
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

