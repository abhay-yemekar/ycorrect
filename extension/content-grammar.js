/**
 * WriteRight content script — grammar.
 *
 * Grammar-check orchestration and AI-rewrite flows (mode chips, sentence rewrite).
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

// ─── Grammar check ──────────────────────────────────────────────
let grammarRequestId = 0;
let grammarPending = null;
let grammarCompleted = null;
async function runGrammarCheck(force = false) {
  const field = activeField;
  if (!field || !siteEnabled || !grammarEnabled) return;
  const text = getFieldText();
  if (!force && ((grammarPending?.field === field && grammarPending.text === text) ||
      (grammarCompleted?.field === field && grammarCompleted.text === text))) return;
  const requestId = ++grammarRequestId;
  grammarPending = { field, text };
  showSpinner();
  _lastCheckedText = text;
  if (!text || text.trim().length < 3) {
    currentMatches = [];
    clearHighlights();
    updateIssueCount();
    updateBadgeCount();
    hideSpinner();
    grammarPending = null;
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'checkGrammar', text });
    if (requestId !== grammarRequestId || activeField !== field || !field.isConnected ||
        !siteEnabled || !grammarEnabled || getFieldText(field) !== text) return;
    if (resp?.error || !Array.isArray(resp?.matches)) {
      currentMatches = [];
      clearHighlights();
      updateIssueCount();
      updateBadgeCount();
      if (sidebarEl) hideSidebar();
      showToast(resp?.error || 'Grammar check returned an invalid response.', 'error');
      return;
    }
    if (resp && resp.matches) {
      grammarCompleted = { field, text };
      currentMatches = resp.matches;
      clearHighlights();
      renderHighlights();
      updateIssueCount();
      updateBadgeCount();
      // Auto-show sidebar on first grammar check that finds issues
      const visibleCount = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message)).length;
      if (visibleCount > 0 && (!sidebarEl || sidebarEl.style.display === 'none')) {
        showSidebar();
      } else if (visibleCount === 0 && sidebarEl && sidebarEl.style.display !== 'none') {
        renderSidebar();
      } else if (sidebarEl && sidebarEl.style.display !== 'none') {
        renderSidebar();
      }
    }
  } catch {
    showToast("Could not reach WriteRight server. Make sure npm start is running.", "error");
  } finally {
    if (requestId === grammarRequestId) { grammarPending = null; hideSpinner(); }
  }
}

function scheduleGrammarCheck() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (grammarEnabled && activeField) runGrammarCheck();
  }, DEBOUNCE_MS);
}

// ─── AI rewrite ─────────────────────────────────────────────────
async function rewriteSelection(mode) {
  const target = captureSelectionTarget();
  if (!target || target.original.trim().length < 3) return;
  hideRewriteChip();
  await requestReviewRewrite(target, mode);
}

function rewriteSentence(match, mode) {
  if (!activeField) return;
  const text = getFieldText();
  if (text !== _lastCheckedText) return showToast('Text changed. Check grammar again.', 'error');
  const start = text.lastIndexOf('.', match.offset - 1) + 1;
  const dot = text.indexOf('.', match.offset + match.length);
  const end = dot < 0 ? text.length : dot + 1;
  // Keep surrounding whitespace inside the captured range; do not trim offsets.
  return requestReviewRewrite(captureReviewTarget(start, end), mode);
}

let rewriteRequestId = 0;
let rewriteLoadingEl = null;
function cancelPendingRewrite() {
  rewriteRequestId++;
  if (rewriteLoadingEl) rewriteLoadingEl.remove();
  rewriteLoadingEl = null;
}

async function requestReviewRewrite(target, mode) {
  if (!target) return;
  cancelPendingRewrite();
  dismissSuggestionReview();
  const requestId = ++rewriteRequestId;
  ensureShadowHost();
  rewriteLoadingEl = document.createElement('div');
  rewriteLoadingEl.className = 'wr-toast';
  rewriteLoadingEl.setAttribute('role', 'status');
  rewriteLoadingEl.innerHTML = '<span>Preparing rewrite…</span><button class="wr-fix-btn">Cancel</button>';
  rewriteLoadingEl.querySelector('button').addEventListener('click', cancelPendingRewrite);
  shadowRoot.appendChild(rewriteLoadingEl);
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'rewrite', text: target.original, mode });
    if (requestId !== rewriteRequestId || !siteEnabled) return;
    if (resp?.error || !resp?.suggestion) return showToast(resp?.error || 'The server returned no rewrite. Try again.', 'error');
    if (resp && resp.suggestion) showSuggestionReview(target, resp.suggestion, mode + ' rewrite');
  } catch {
    if (requestId === rewriteRequestId && siteEnabled) showToast('Could not reach WriteRight server.', 'error');
  } finally {
    if (requestId === rewriteRequestId) {
      if (rewriteLoadingEl) rewriteLoadingEl.remove();
      rewriteLoadingEl = null;
    }
  }
}
