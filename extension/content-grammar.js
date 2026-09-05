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
async function runGrammarCheck() {
  const requestId = ++grammarRequestId;
  const field = activeField;
  if (!field || !siteEnabled || !grammarEnabled) return;
  showSpinner();
  const text = getFieldText();
  _lastCheckedText = text;
  if (!text || text.trim().length < 3) {
    currentMatches = [];
    clearHighlights();
    updateIssueCount();
    updateBadgeCount();
    hideSpinner();
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: 'checkGrammar', text });
    if (requestId !== grammarRequestId || activeField !== field || !field.isConnected ||
        !siteEnabled || !grammarEnabled || getFieldText(field) !== text) return;
    if (resp && resp.matches) {
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
    if (requestId === grammarRequestId) hideSpinner();
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

async function requestReviewRewrite(target, mode) {
  if (!target) return;
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'rewrite', text: target.original, mode });
    if (resp && resp.suggestion) showSuggestionReview(target, resp.suggestion, mode + ' rewrite');
  } catch { showToast('Could not reach WriteRight server.', 'error'); }
}
