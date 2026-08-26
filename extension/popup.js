/**
 * Popup logic — manages per-site toggles, grammar toggle, and server health check.
 */

const DEFAULT_SERVER = 'http://localhost:3000';

let currentHostname = '';

// ─── Init ───────────────────────────────────────────────────────
async function init() {
  // Get current tab's hostname
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try {
      currentHostname = new URL(tab.url).hostname;
    } catch { /* ignore */ }
  }
  document.getElementById('site-name').textContent = currentHostname || 'this site';

  // Load toggles
  const data = await chrome.storage.sync.get({
    disabledSites: [],
    grammarEnabled: true,
  });

  const siteEnabled = !data.disabledSites.includes(currentHostname);
  setToggle('toggle-site', siteEnabled);
  setToggle('toggle-grammar', data.grammarEnabled !== false);

  // Server status
  checkServerStatus();
}

// ─── Toggle helpers ─────────────────────────────────────────────
function setToggle(id, on) {
  const el = document.getElementById(id);
  el.classList.toggle('on', on);
}

function getToggle(id) {
  return document.getElementById(id).classList.contains('on');
}

// ─── Event handlers ─────────────────────────────────────────────
document.getElementById('toggle-site').addEventListener('click', async () => {
  const next = !getToggle('toggle-site');
  setToggle('toggle-site', next);

  const data = await chrome.storage.sync.get({ disabledSites: [] });
  let list = data.disabledSites || [];
  if (next) {
    // Re-enable: remove from disabled list
    list = list.filter(h => h !== currentHostname);
  } else {
    // Disable: add to list
    if (!list.includes(currentHostname)) list.push(currentHostname);
  }
  await chrome.storage.sync.set({ disabledSites: list });
});

document.getElementById('toggle-grammar').addEventListener('click', async () => {
  const next = !getToggle('toggle-grammar');
  setToggle('toggle-grammar', next);
  await chrome.storage.sync.set({ grammarEnabled: next });
});

document.getElementById('open-app').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:3000' });
});

// ─── Server health ──────────────────────────────────────────────
async function checkServerStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER });
    const base = (stored.serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health`);
    if (res.ok) {
      const data = await res.json();
      dot.classList.add('connected');
      text.textContent = `Connected — v${data.version || '?'}`;
      return;
    }
  } catch { /* unreachable */ }
  dot.classList.remove('connected');
  text.textContent = 'Server not reachable';
}

// ─── Run ────────────────────────────────────────────────────────
init();
