/**
 * AI module — paraphrase, summarize, and tone detection.
 *
 * Communicates with the local server's API endpoints which proxy
 * to the Gemini API with the key kept server-side.
 */

import { $, esc, notify, getSelectedText } from './utils.js';
import { getEditor, setText } from './editor.js';
import { pushUndoState } from './shortcuts.js';

// ─── Paraphrase modes ─────────────────────────────────────────────

const PARA_MODES = {
  Standard: 'Paraphrase this text naturally, keeping the same meaning and length.',
  Fluency: 'Rewrite this text for fluent, natural English; fix awkward phrasing while preserving meaning.',
  Formal: 'Rewrite this text in formal, professional English.',
  Academic: 'Rewrite this text in academic style with precise vocabulary and a formal structure.',
  Simple: 'Rewrite this text in plain, simple English that anyone can understand.',
  Creative: 'Rewrite this text in a creative, vivid, engaging style.',
  Expand: 'Expand this text with more detail and depth while keeping the same meaning.',
  Shorten: 'Shorten this text, keeping only the essential meaning in fewer words.',
};

// ─── Writing goals ────────────────────────────────────────────────

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem('ycorrectGoals') || '{}');
  } catch {
    return {};
  }
}

function saveGoals(goals) {
  localStorage.setItem('ycorrectGoals', JSON.stringify(goals));
}

// ─── Core AI call ─────────────────────────────────────────────────

async function aiCall(text, mode, temperature, goals) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode, temperature, goals }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI request failed');
  return data.text;
}

// ─── Variant HTML ─────────────────────────────────────────────────

function variantHtml(text) {
  return (
    `<div class="variant">` +
      `<div class="ai-text">${esc(text)}</div>` +
      `<div class="ai-actions">` +
        `<button class="btn ghost small" data-replace="${esc(text)}">Replace</button>` +
        `<button class="btn ghost small" data-copy="${esc(text)}">Copy</button>` +
      `</div>` +
    `</div>`
  );
}

// ─── Paraphrase ───────────────────────────────────────────────────

async function handleParaphrase() {
  const editor = getEditor();
  const scope = getSelectedText(editor);
  const text = scope || editor.value;

  if (!text.trim()) return notify('Write or paste some text first.');

  const modeName = $('#paraMode').value;
  const mode = PARA_MODES[modeName];
  const strength = +$('#paraStrength').value / 100;
  const temperature = (mode.includes('Creative') || mode.includes('Expand'))
    ? 0.5 + strength * 0.45
    : 0.15 + strength * 0.5;

  const output = $('#paraphraseOut');
  output.innerHTML = '<div class="ai-loading">Generating two variants…</div>';

  try {
    const goals = loadGoals();
    const [a, b] = await Promise.all([
      aiCall(text, mode, temperature, goals),
      aiCall(text, mode, Math.min(1, temperature + 0.15), goals),
    ]);
    output.innerHTML = variantHtml(a) + variantHtml(b);
  } catch (err) {
    output.innerHTML = `<div class="ai-error">${esc(err.message)}</div>`;
  }
}

// ─── Summarize ────────────────────────────────────────────────────

async function handleSummarize() {
  const editor = getEditor();
  const scope = getSelectedText(editor);
  const text = scope || editor.value;

  if (!text.trim()) return notify('Write or paste some text first.');

  const style = $('#sumStyle').value;
  const length = $('#sumLength').value;
  const output = $('#summarizeOut');

  output.innerHTML = '<div class="ai-loading">Summarizing…</div>';

  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, style, length }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Summary failed');

    output.innerHTML = variantHtml(data.text);
  } catch (err) {
    output.innerHTML = `<div class="ai-error">${esc(err.message)}</div>`;
  }
}

// ─── Tone detection ───────────────────────────────────────────────

let toneState = { tone: 'Tone —', at: 0, sig: '' };

export async function checkTone(force = false) {
  const editor = getEditor();
  const text = editor.value.trim();
  if (!text) return;

  const sig = text.slice(0, 200);
  if (!force && toneState.sig === sig && Date.now() - toneState.at < 30000) return;

  try {
    const res = await fetch('/api/tone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 6000) }),
    });
    const data = await res.json();
    if (!res.ok) return;

    toneState = { tone: `${data.tone} · ${data.formality}`, at: Date.now(), sig };
    const badge = $('#toneBadge');
    if (badge) badge.textContent = toneState.tone;
  } catch {
    // Silent failure for tone detection
  }
}

let toneTimer = null;

export function scheduleToneCheck() {
  clearTimeout(toneTimer);
  toneTimer = setTimeout(checkTone, 3000);
}

// ─── Replace/Copy delegation ──────────────────────────────────────

function handleReplaceOrCopy(e) {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    navigator.clipboard?.writeText(copyBtn.dataset.copy);
    notify('Copied to clipboard');
    return;
  }

  const replaceBtn = e.target.closest('[data-replace]');
  if (replaceBtn) {
    const value = replaceBtn.dataset.replace;
    const editor = getEditor();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    // Save state for undo before replacing
    pushUndoState('AI replacement');

    if (start !== end) {
      // Replace the selection
      setText(editor.value.slice(0, start) + value + editor.value.slice(end), start);
    } else {
      // Replace the entire document
      setText(value, 0);
    }

    // setText fires the input pipeline: overlay shifts, stats update,
    // the document saves, and a fresh grammar check is scheduled.
    notify('Replaced');
  }
}

// ─── Writing goals UI ─────────────────────────────────────────────

function initGoals() {
  const goals = loadGoals();
  const fields = { goalAud: 'audience', goalForm: 'formality', goalGenre: 'genre' };

  for (const [elId, key] of Object.entries(fields)) {
    const el = $(`#${elId}`);
    if (el && goals[key]) el.value = goals[key];
  }

  document.querySelectorAll('#goalAud,#goalForm,#goalGenre').forEach(el => {
    el.addEventListener('change', () => {
      const g = {};
      for (const [elId, key] of Object.entries(fields)) {
        const e = $(`#${elId}`);
        if (e) g[key] = e.value;
      }
      saveGoals(g);
      notify('Writing goals saved');
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────

export function initAI() {
  // Paraphrase
  const paraStrength = $('#paraStrength');
  if (paraStrength) {
    paraStrength.addEventListener('input', () => {
      const strengthVal = $('#strengthVal');
      if (strengthVal) strengthVal.textContent = paraStrength.value + '%';
    });
  }

  const paraphraseBtn = $('#paraphraseBtn');
  if (paraphraseBtn) paraphraseBtn.addEventListener('click', handleParaphrase);

  // Summarize
  const summarizeBtn = $('#summarizeBtn');
  if (summarizeBtn) summarizeBtn.addEventListener('click', handleSummarize);

  // Tone badge
  const toneBadge = $('#toneBadge');
  if (toneBadge) toneBadge.addEventListener('click', () => checkTone(true));

  // Replace/Copy delegation (works for both paraphrase and summarize outputs)
  document.addEventListener('click', handleReplaceOrCopy);

  // Writing goals
  initGoals();
}
