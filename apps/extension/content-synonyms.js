/**
 * WriteRight content script — synonyms.
 *
 * Synonym lookup and its popover.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

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

function _onDoubleClick(e) {
  if (!activeField) return;
  const text = getFieldText();
  if (!text) return;
  const pos = activeField.selectionStart || 0;
  const { word } = wordAtCursor(text, pos);
  if (!word || word.length < 2) return;
  const rect = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : { bottom: e.clientY + 10, left: e.clientX };
  showSynonyms(word, rect);
}

