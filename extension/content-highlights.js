/**
 * WriteRight content script — highlights.
 *
 * Underline-highlight rendering (text-search approach) and its click handling.
 *
 * This is one part of the split of the former single-file content script.
 * manifest.json loads these files in order into the same isolated world,
 * so top-level functions and consts are shared across parts exactly as if
 * they were one script. Keep declarations unique across parts.
 */

// ─── Underline highlights (text-search approach) ────────────────
// Instead of using offset-based char maps (which break when innerText
// and text nodes disagree on newlines), we search for the error text
// directly in DOM text nodes. This is more robust on ProseMirror.

function createHighlightsContainer() {
  if (highlightsContainer && shadowRoot && shadowRoot.contains(highlightsContainer)) return;
  ensureShadowHost();
  highlightsContainer = document.createElement('div');
  highlightsContainer.id = 'wr-highlights';
  highlightsContainer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;overflow:visible;';
  shadowRoot.appendChild(highlightsContainer);
}

function removeHighlightsContainer() {
  if (highlightsContainer) { highlightsContainer.remove(); highlightsContainer = null; }
}

function clearHighlights() {
  if (highlightsContainer) highlightsContainer.innerHTML = '';
}

/**
 * Add a single highlight underline element at a bounding rect position.
 */
function addHighlight(rect, match) {
  if (rect.width < 2) return;
  const issueType = match.rule?.issueType || 'other';
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

/**
 * Find a DOM Range for a grammar match by walking text nodes.
 * This is more robust than charMap.indexOf because it finds the exact
 * Nth occurrence of the error text, not just the first.
 */

/**
 * Collect all text nodes with their cumulative character offsets.
 * Returns { nodes: [{ node, start, length }], fullText: string }.
 */
function collectTextNodes(field) {
  const nodes = [];
  let cumulative = 0;
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: cumulative, length: node.textContent.length });
    cumulative += node.textContent.length;
  }
  const fullText = nodes.map(n => n.node.textContent).join('');
  return { nodes, fullText };
}

/**
 * Build a DOM Range from a known start/end position across text nodes.
 */
function buildRange(textNodes, start, end) {
  let startNode = null, startOff = 0;
  let endNode = null, endOff = 0;
  for (const tn of textNodes) {
    if (!startNode && tn.start + tn.length > start) {
      startNode = tn.node;
      startOff = start - tn.start;
    }
    if (tn.start < end && tn.start + tn.length >= end) {
      endNode = tn.node;
      endOff = end - tn.start;
    }
  }
  if (!startNode || !endNode) return null;
  try {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  } catch {
    return null;
  }
}

function findMatchRange(field, match, currentText, textNodes) {
  const txt = currentText || getFieldText();
  const target = txt.slice(match.offset, match.offset + match.length);
  if (!target) return null;

  const nodes = textNodes || collectTextNodes(field).nodes;
  const totalLen = nodes.reduce((sum, n) => sum + n.length, 0);
  if (totalLen === 0) return null;

  const matchEnd = match.offset + match.length;

  // Tier 1: Exact offset match with text verification
  if (match.offset >= 0 && matchEnd <= totalLen) {
    const slice = txt.slice(match.offset, matchEnd);
    if (slice === target) {
      const range = buildRange(nodes, match.offset, matchEnd);
      if (range) return range;
    }
  }

  // Tier 2: Search for target text within single text nodes
  for (let i = 0; i < nodes.length; i++) {
    const nodeText = nodes[i].node.textContent;
    const idx = nodeText.indexOf(target);
    if (idx >= 0) {
      const range = buildRange(nodes, nodes[i].start + idx, nodes[i].start + idx + target.length);
      if (range) return range;
    }
  }

  // Tier 3: Cross-node search (target spans two adjacent text nodes)
  for (let i = 0; i < nodes.length - 1; i++) {
    let combined = nodes[i].node.textContent;
    for (let j = i + 1; j < Math.min(i + 4, nodes.length); j++) {
      combined += nodes[j].node.textContent;
      const idx = combined.indexOf(target);
      if (idx >= 0) {
        const range = buildRange(nodes, nodes[i].start + idx, nodes[i].start + idx + target.length);
        if (range) return range;
      }
    }
  }

  // Tier 4: Strip invisible Unicode chars and retry with correct offset mapping
  const INV_RE = /[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g;
  const cleanTarget = target.replace(INV_RE, '');
  if (cleanTarget && cleanTarget.length > 0) {
    const cleanFull = txt.replace(INV_RE, '');
    const cleanIdx = cleanFull.indexOf(cleanTarget);
    if (cleanIdx >= 0) {
      // Map cleanText position back to original text position
      let origPos = 0, cleanPos = 0;
      while (origPos < txt.length && cleanPos < cleanIdx) {
        if (!INV_RE.test(txt[origPos])) {
          cleanPos++;
        }
        INV_RE.lastIndex = 0;
        origPos++;
      }
      const origStart = origPos;
      const origEnd = origStart + target.length;
      if (origEnd <= totalLen) {          const range = buildRange(nodes, origStart, origEnd);
        if (range) return range;
      }
    }
  }

  return null;
}function renderHighlights() {
  clearHighlights();
  if (!activeField) return;

  // Textareas and inputs: use a simple overlay approach
  if (activeField.tagName === 'TEXTAREA' || activeField.tagName === 'INPUT') {
    renderTextareaHighlights();
    return;
  }

  createHighlightsContainer();

  const visible = currentMatches.filter(m => !ignoreSet.has(m.rule?.id + '|' + m.message));
  if (visible.length === 0) return;

  // Snapshot text and text nodes NOW so offsets stay in sync
  const { nodes: textNodes, fullText: currentText } = collectTextNodes(activeField);

  for (const match of visible) {
    const range = findMatchRange(activeField, match, currentText, textNodes);
    if (!range) continue;

    const rects = range.getClientRects();
    if (!rects || rects.length === 0) {
      const br = range.getBoundingClientRect();
      if (br && br.width > 0) {
        addHighlight(br, match);
      }
      range.detach();
      continue;
    }

    for (const rect of rects) {
      addHighlight(rect, match);
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
  // This handler is on shadowRoot, so e.target is the actual highlight element
  const hl = e.target.closest('.wr-highlight');
  if (!hl) return;
  e.stopPropagation();
  const offset = parseInt(hl.dataset.matchOffset, 10);
  const match = currentMatches.find(m => m.offset === offset);
  if (!match) return;
  const rect = hl.getBoundingClientRect();
  showFixCard(match, rect);
}

/** Dismiss fix card when clicking outside the shadow DOM */
function onDocumentClick(e) {
  if (!fixCardEl) return;
  // If click is outside the shadow DOM, dismiss
  if (!e.target.closest || !e.target.closest('#writeright-shadow-host')) {
    hideFixCard();
  }
}

