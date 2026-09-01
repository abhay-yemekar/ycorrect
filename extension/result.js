/**
 * Result popup — renders original vs. suggestion (or an error), with Copy.
 * The payload is placed in chrome.storage.session by the background worker.
 */

const content = document.getElementById('content');
const footer = document.getElementById('footer');
const copyBtn = document.getElementById('copy');

function renderError(message) {
  const div = document.createElement('div');
  div.className = 'error';
  div.textContent = message;
  content.appendChild(div);
}

function renderResult(original, suggestion) {
  const mk = (heading, text, cls) => {
    const section = document.createElement('section');
    section.className = cls;
    const h = document.createElement('h2');
    h.textContent = heading;
    const box = document.createElement('div');
    box.className = 'text';
    box.textContent = text;
    section.append(h, box);
    return section;
  };
  content.appendChild(mk('Original', original, 'original'));
  content.appendChild(mk('Suggestion', suggestion, 'suggestion'));
  footer.hidden = false;
}

chrome.storage.session.get({ result: null }).then(({ result }) => {
  if (!result) {
    renderError('Nothing to show — open this from the "Improve with WriteRight" menu item.');
    return;
  }
  if (result.error) {
    renderError(result.error);
    return;
  }
  const suggestion = result.suggestion || '(The server returned an empty suggestion.)';
  renderResult(result.original || '', suggestion);
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(suggestion);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy suggestion'; }, 1600);
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
  });
});
