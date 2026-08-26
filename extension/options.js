/**
 * Options page logic — persist the server URL to chrome.storage.sync.
 */

const DEFAULT_SERVER = 'http://localhost:3000';
const input = document.getElementById('serverUrl');
const status = document.getElementById('status');

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

async function load() {
  const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER });
  input.value = stored.serverUrl || DEFAULT_SERVER;
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

document.getElementById('reset').addEventListener('click', async () => {
  input.value = DEFAULT_SERVER;
  await chrome.storage.sync.set({ serverUrl: DEFAULT_SERVER });
  flash('Saved ✓');
});

load();
