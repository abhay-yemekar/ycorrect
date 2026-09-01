/**
 * WriteRight extension — background service worker.
 *
 * Handles two paths:
 * 1. Context-menu item → POST to /api/ai → open result popup (legacy v0.2 path)
 * 2. Content-script messages → proxy to /api/grammar or /api/ai → return response
 *
 * The server URL is configurable via the options page (chrome.storage.sync).
 */

const DEFAULT_SERVER = 'http://localhost:3000';

async function getServerUrl() {
  const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER });
  const url = (stored.serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
  return url;
}

// ─── Context-menu path (legacy v0.2) ───────────────────────────
function openResult(payload) {
  chrome.storage.session.set({ result: payload }).then(() => {
    chrome.windows.create({
      url: 'result.html',
      type: 'popup',
      width: 480,
      height: 600,
    });
  });
}

async function improveSelection(text) {
  let base;
  try {
    base = await getServerUrl();
  } catch {
    openResult({ error: 'Could not read the configured server URL.' });
    return;
  }

  try {
    const res = await fetch(`${base}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode: 'Fluency' }),
    });

    if (!res.ok) {
      let message = `Server responded ${res.status}`;
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch { /* non-JSON body */ }
      if (res.status === 429) message = 'Rate limited — give it a moment and retry.';
      if (!message.includes('WriteRight')) message = `${base} — ${message}`;
      openResult({ error: message });
      return;
    }

    const data = await res.json();
    openResult({ original: text, suggestion: typeof data.text === 'string' ? data.text : '' });
  } catch {
    openResult({
      error: `Could not reach WriteRight at ${base}. Start the server (npm start) or fix the URL in the extension options.`,
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ycorrect',
    title: 'Improve with WriteRight',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'ycorrect' || !info.selectionText) return;
  improveSelection(info.selectionText);
});

// ─── Content-script message handlers ────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'openApp') {
    chrome.tabs.create({ url: 'http://localhost:3000' });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'checkGrammar') {
    checkGrammar(msg.text).then(sendResponse).catch(() => sendResponse({ matches: [] }));
    return true; // async response
  }

  if (msg.type === 'rewrite') {
    rewrite(msg.text, msg.mode).then(sendResponse).catch(() => sendResponse({ suggestion: '' }));
    return true; // async response
  }

  if (msg.type === 'getSynonyms') {
    getSynonyms(msg.word).then(sendResponse).catch(() => sendResponse({ synonyms: [], antonyms: [], definitions: [] }));
    return true; // async response
  }

  return false;
});

async function checkGrammar(text) {
  const base = await getServerUrl();
  const res = await fetch(`${base}/api/grammar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { matches: [] };
  const data = await res.json();
  return { matches: data.matches || [] };
}

async function rewrite(text, mode) {
  const base = await getServerUrl();
  const res = await fetch(`${base}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode: mode || 'Humanize', strength: 0.5, variant: 1 }),
  });
  if (!res.ok) return { suggestion: '' };
  const data = await res.json();
  return { suggestion: typeof data.text === 'string' ? data.text : '' };
}

async function getSynonyms(word) {
  const base = await getServerUrl();
  const res = await fetch(`${base}/api/synonyms?word=${encodeURIComponent(word)}`);
  if (!res.ok) return { synonyms: [], antonyms: [], definitions: [] };
  return res.json();
}
