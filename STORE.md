# Chrome Web Store packaging — WriteRight

This file is the store-submission kit for the extension (audit roadmap item 11).
It is NOT the listing itself — the listing text lives in the store dashboard.
Everything here is copy-paste ready and kept in-repo so the listing can't drift
from the actual extension.

## Build the upload zip

```bash
node scripts/package-extension.js
# -> dist/write-right-<version>.zip  (verified by `npm run check`'s zip test)
```

## Listing draft

- **Name:** WriteRight — Writing Assistant
- **Category:** Productivity
- **Short description (up to 132 chars):**
  In-page grammar check and AI rewriting on any website. Works with your local
  WriteRight server — your text never leaves your machine.
- **Detailed description:**
  WriteRight is a privacy-first writing assistant. Click into any text field on
  any website and a badge appears; click it to run a grammar check (via your
  local LanguageTool-powered server) or select text to rewrite it with AI modes
  like Formal, Simple, Creative, and Humanize.

  Highlights:
  - Grammar check with click-to-fix cards and a Fix All button
  - Right-click any selection for instant AI rewriting
  - Per-site enable/disable and a master grammar toggle
  - Synonym suggestions, sentence continuation, and citation formatting
  - Works on textareas, inputs, and rich editors (contenteditable)

  Requirements: WriteRight requires the free, self-hosted WriteRight server
  (https://github.com/abhay-yemekar/ycorrect) running locally on
  http://localhost:3000. Your text is sent only to that server — never to a
  third-party cloud.
- **Screenshots (need 1–5, 1280×800 or 640×400):**
  1. Options page (server URL + per-site controls)
  2. Badge + underline highlights on a page's textarea
  3. Fix card with suggested replacement
  4. AI rewrite mode chips on a selection
  5. Popup with site/grammar toggles and server status
- **Small promo tile (440×280):** reuse screenshot 2.
- **Icon:** `extension/icons/icon128.png` (must be at least 128×128).

## Privacy practices (developer dashboard)

- **Single purpose:** check and improve the user's writing in web pages.
- **Data usage:** none collected. The extension sends text only to the
  user-configured localhost server, never to the extension developer.
- **Permissions rationale** (must match the manifest exactly):
  - `storage` — saves server URL, per-site disable list, grammar toggle, and
    last check results.
  - `contextMenus` — the "Improve with WriteRight" right-click menu item.
  - `host_permissions: http://localhost/*, http://127.0.0.1/*` — talking to
    the user's own local WriteRight server.
  - `content_scripts: http://*/*, https://*/*` — the assistant must run inside
    the text fields of whatever sites the user visits. No site data is sent
    anywhere except the local server, and WriteRight stays inactive on sites
    the user disables.

## Manual submission steps (cannot be automated)

1. Pay the one-time $5 Chrome Web Store developer registration fee.
2. Zip is built above — upload it to the Chrome Web Store developer dashboard.
3. Fill in the listing fields from this draft, upload screenshots + icon.
4. Choose distribution: *Unlisted* first for a private smoke test, then
   *Public* once the browser smoke pass (see PROGRESS.md) is complete.
5. Expect a 1–3 day review; privacy-practice answers must match the rationale
   above.

## Version discipline

Bump `extension/manifest.json` `version` (semver) for every store update and
re-run `node scripts/package-extension.js`. The zip filename embeds the version
so old uploads never get confused with new ones.
