/**
 * yCorrect extension — background service worker.
 *
 * Context-menu item → POST the selection to the local yCorrect server
 * (/api/ai) → open a popup window showing original vs. suggestion with a
 * Copy action. The server URL is configurable on the options page
 * (chrome.storage.sync, default http://localhost:3000).
 *
 * The mode is sent as a KEY from the server's fixed paraphrase-mode map
 * (v0.2: free-text modes are rejected). `Fluency` = "fix awkward phrasing"
 * matches this item's "improve" intent.
 */

const DEFAULT_SERVER = 'http://localhost:3000';
const MODE_KEY = 'Fluency';

async function getServerUrl() {
  const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER });
  const url = (stored.serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
  return url;
}

function openResult(payload) {
  // Payload goes through storage.session — suggestion text can exceed safe
  // URL length, and the result page needs it after the window opens.
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
      body: JSON.stringify({ text, mode: MODE_KEY }),
    });

    if (!res.ok) {
      let message = `Server responded ${res.status}`;
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch { /* non-JSON body */ }
      if (res.status === 429) message = 'Rate limited — give it a moment and retry.';
      if (!message.includes('yCorrect')) message = `${base} — ${message}`;
      openResult({ error: message });
      return;
    }

    const data = await res.json();
    openResult({ original: text, suggestion: typeof data.text === 'string' ? data.text : '' });
  } catch {
    openResult({
      error: `Could not reach yCorrect at ${base}. Start the server (npm start) or fix the URL in the extension options.`,
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ycorrect',
    title: 'Improve with yCorrect',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'ycorrect' || !info.selectionText) return;
  improveSelection(info.selectionText);
});
