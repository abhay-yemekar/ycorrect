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
async function runGrammarCheck() {
  showSpinner();
  const text = getFieldText();
  _lastCheckedText = text;
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

