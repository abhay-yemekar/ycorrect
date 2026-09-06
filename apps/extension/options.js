/**
 * Options page logic — server URL, grammar toggle, per-site disable list,
 * and a one-click reset. All keys (serverUrl, grammarEnabled, disabledSites)
 * are the same ones the popup and content script already read, so nothing
 * here changes runtime behavior — it just gives a fuller management UI.
 */

const DEFAULT_SERVER = 'http://localhost:3000';
const input = document.getElementById('serverUrl');
const status = document.getElementById('status');
const grammarToggle = document.getElementById('toggle-grammar');
const siteList = document.getElementById('site-list');

function flash(message) {
  status.textContent = message;
  setTimeout(() => { status.textContent = ''; }, 2000);
}

/** Accept http(s) URLs only; anything else is rejected with a reason. */
function validate(raw) {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) return { error: 'Enter a URL, or reset to the default.' };
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { error: 'Not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http:// and https:// URLs are supported.' };
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    return { error: 'Use the origin only — no path (e.g. http://localhost:3000).' };
  }
  return { value: parsed.origin };
}

function setGrammarToggle(on) {
  grammarToggle.classList.toggle('on', on);
  grammarToggle.setAttribute('aria-checked', String(on));
}

/** Render the disabled-sites list as removable chips. */
function renderSites(sites) {
  siteList.textContent = '';
  if (!sites || sites.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'empty';
    empty.textContent = 'No sites disabled.';
    siteList.appendChild(empty);
    return;
  }
  for (const host of sites) {
    const chip = document.createElement('span');
    chip.className = 'site-chip';
    chip.textContent = host;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'Re-enable WriteRight on ' + host;
    remove.addEventListener('click', async () => {
      const data = await chrome.storage.sync.get({ disabledSites: [] });
      const next = (data.disabledSites || []).filter(h => h !== host);
      await chrome.storage.sync.set({ disabledSites: next });
      renderSites(next);
      flash('Removed ' + host);
    });

    chip.appendChild(remove);
    siteList.appendChild(chip);
  }
}

async function load() {
  const stored = await chrome.storage.sync.get({
    serverUrl: DEFAULT_SERVER,
    grammarEnabled: true,
    disabledSites: [],
  });
  input.value = stored.serverUrl || DEFAULT_SERVER;
  setGrammarToggle(stored.grammarEnabled !== false);
  renderSites(stored.disabledSites);
}

document.getElementById('save').addEventListener('click', async () => {
  const result = validate(input.value);
  if (result.error) {
    flash(result.error);
    return;
  }
  await chrome.storage.sync.set({ serverUrl: result.value });
  input.value = result.value;
  flash('Saved ✓');
});

grammarToggle.addEventListener('click', async () => {
  const next = !grammarToggle.classList.contains('on');
  setGrammarToggle(next);
  await chrome.storage.sync.set({ grammarEnabled: next });
  flash(next ? 'Grammar on ✓' : 'Grammar off');
});

document.getElementById('reset').addEventListener('click', async () => {
  input.value = DEFAULT_SERVER;
  setGrammarToggle(true);
  await chrome.storage.sync.set({
    serverUrl: DEFAULT_SERVER,
    grammarEnabled: true,
    disabledSites: [],
  });
  renderSites([]);
  flash('Reset to defaults ✓');
});

load();
