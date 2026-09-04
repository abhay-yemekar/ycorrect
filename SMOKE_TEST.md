# Extension smoke test — real-browser pass (AUDIT.md item F / roadmap "Next-4")

This is the manual checklist for the audit's highest-risk open item: verifying
the extension end-to-end in a real browser. It cannot be automated (no browser
is available to the agent), so it is written for a human with Chrome.

**Why this exists:** PROGRESS.md has a history of shipping "underline fixed for
ChatGPT/ProseMirror" fixes that were never confirmed in a browser. This pass
is the verification gate those fixes (and the content-script split) need.
Every row should be answered — no blanks. "Counted, not estimated."

---

## 0. Prerequisites

1. Start the server: `npm start` (http://localhost:3000). Confirm
   `http://localhost:3000/api/health` returns 200 with a version.
2. Load the extension unpacked in Chrome:
   - Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
3. Open the extension's **Options** page (right-click the toolbar icon →
   **Options**). Confirm the default server URL is `http://localhost:3000`.
4. Have a Gemini key in `server/.env` (`GEMINI_API_KEY`) if you want to test
   AI rewrite; grammar + synonyms work without it (LanguageTool is public).
5. **Post-split sanity (NEW — most important check this round):** visit any
   plain page with a text field (see §1). Open DevTools console. There must be
   **no** errors — specifically no `ReferenceError`, no
   `Identifier '…' has already been declared`. The seven content parts load in
   order into one isolated world; any error here means the split is broken.

## 1. Local test page (fastest, most reliable)

Serve a page with every field type from localhost (matches the content script
and the server's CORS):

```bash
mkdir -p /tmp/wr-smoke
printf '%s\n' \
  '<!doctype html><title>WR smoke</title>' \
  '<textarea id="t" style="width:500px;height:200px">' \
  'They was going too the store on 3/3/2025 and its a nice day. alot of people are there.' \
  '</textarea>' \
  '<input type="text" id="i" value="this is a test with a common typo">' \
  '<input type="password" id="p" placeholder="password">' \
  '<div contenteditable="true" id="ce" style="border:1px solid #ccc;min-height:100px">' \
  'They was going too the store and its a nice day.</div>' \
  '<script>document.getElementById("t").focus();</script>' \
  > /tmp/wr-smoke/index.html
python3 -m http.server 8123 --directory /tmp/wr-smoke
```

Open `http://localhost:8123` and run §2–§6 against the textarea, the input,
and the contenteditable. The password input must show **no badge** (field
exclusion from the Now phase — `FIELD_SELECTOR` skips `type=password`).

## 2. Badge & field activation (all field types)

| Check | Steps | Expected | Failure signal |
|---|---|---|---|
| Badge appears | Click into textarea / input / contenteditable | Small badge near the field (green dot + count) | No badge → content script didn't run or `init` failed (check console) |
| Badge hides | Click a non-editable area / blur | Badge disappears | Badge stays → `onFieldBlur` issue |
| Badge on password fields | Click the password input | **No badge** | Badge shows → `FIELD_SELECTOR` regression |
| Site disable | Click toolbar icon → toggle "Enable on this site" off → reload page → click field | No badge | Badge still appears → `checkSiteEnabled`/storage regression |

## 3. Grammar check, underlines, sidebar (the historical failure zone)

| Check | Steps | Expected | Failure signal |
|---|---|---|---|
| Auto-check fires | Type into the textarea (with the sample text), pause ~1s | Badge count updates; **underlines render under the errors** | Count on badge ≠ number of underlines; no underlines on ChatGPT/GDocs (see §7) |
| Sidebar auto-opens | First check with issues found | Sidebar slides in listing issues | Sidebar missing → `runGrammarCheck` auto-open path |
| Ignore works | Click an issue's dismiss/ignore action if present | Issue moves to ignored list; count drops | Re-appears on every check → `ignoreSet` key mismatch |
| Grammar toggle off | Toolbar popup → Grammar off → retype | No highlights, no sidebar | Highlights remain → toggle not honored |

## 4. Fix flows

| Check | Steps | Expected | Failure signal |
|---|---|---|---|
| Fix card | Click an underlined issue | Card with suggested replacement + Apply / Humanize | Card misplaced, clipped, or empty |
| Apply | Click Apply | Text replaced; highlights re-render; sidebar updates | Offset mismatch (fix wrong text) → `findMatchRange` regression |
| Fix All | Open sidebar → Fix All | All auto-fixable issues replaced at once | Count of fixed ≠ expected; wrong text replaced (descending-offset bug) |
| Escape key | Open fix card / sidebar | All popovers close | Escape does nothing |

## 5. AI rewrite (needs server-side Gemini key)

| Check | Steps | Expected | Failure signal |
|---|---|---|---|
| Rewrite chip | Select 3+ words in the textarea | "✦ Rewrite" chip floats above the selection | No chip → `showRewriteChip` trigger |
| Rewrite result | Click the chip | Suggestion card appears (Humanize mode by default) | Spinner forever / error toast → check server log + `GEMINI_API_KEY` |
| Mode variety | Repeat with the web app's other modes (Formal/Shorten/… are toolbar-only currently; chip uses Humanize default) | Suggestion differs meaningfully per mode | Same output every mode → temperature/mode wiring |
| Context menu | Right-click a selection on any page → "Improve with WriteRight" | `result.html` popup window with original + suggestion | Popup opens with error → `background.js` fetch to server |

## 6. Popup, options, server-down

| Check | Steps | Expected | Failure signal |
|---|---|---|---|
| Popup status | Click toolbar icon with server running | Green dot + "Connected — v…" | Red "Server not reachable" |
| Site toggle | Popup → toggle site off → check on page | Stops working on that site only | Affects all sites → `disabledSites` key confusion |
| Options page | Options → toggle Grammar off, remove a disabled site chip, Reset to defaults | Values persist in `chrome.storage.sync`; Reset restores defaults | Changes don't persist → storage key mismatch |
| Server down | Stop the server, type in a field | Toast: "Could not reach WriteRight server…" | Silent failure |

## 7. Host-site matrix (the audit's named sites)

For each, the critical question is **underlines + badge on rich editors**
(ProseMirror/Quill re-render text nodes; the fuzzy `findMatchRange` fallback
exists for this). Run §2–§4 at least once per site.

| Site | Field to test | Notes / known history |
|---|---|---|
| ChatGPT (chatgpt.com) | Chat composer (contenteditable) | Worst-case ProseMirror re-renderer; invisible unicode chars — the original underline bug |
| Google Docs | A document body | Custom editor; badge must not break native cursor/IME |
| Gmail | Compose (rich + plain) | Check the plain-text mode textarea too |
| Notion | Any page body | Custom editor with its own shadow/overlay layers |
| Gemini (gemini.google.com) | Prompt box | Second ProseMirror target |
| GitHub / Reddit | Issue/comment textarea | Standard textarea — sanity control |

Also spot-check a **banking/sensitive site** login form (e.g. your bank's
sign-in): the badge must never appear on credential fields, and the extension
must not interfere with typing.

## 8. Failure triage (where to look)

1. `chrome://extensions` → the extension → **service worker** link → see
   `background.js` errors (fetch failures, CORS).
2. Page DevTools → **Console** → filter `wr-` (shadow-DOM ids) and look for
   `ReferenceError`/`TypeError` (split issues) or `Failed to load resource`
   (server/URL issues).
3. Page DevTools → **Network** → look for requests to `localhost:3000/api/…`.
   If absent, the content script never reached the background worker.
4. Server terminal → errors around `/api/grammar`, `/api/ai`, `/api/synonyms`.
5. Underline-specific: select the field text with DevTools inspect; confirm
   `collectTextNodes`/`renderHighlights` actually attached marker elements
   inside the shadow host (body `wr-underline` elements exist in the shadow
   root).

## 9. Verification record

Fill this in; commit it back to PROGRESS.md when complete.

| Date | Site/field | Badge | Underlines | Sidebar | Fix | Rewrite | Console errors? |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

---

## Appendix — known dead code (do not test, but be aware)

- `_showToolbar` (content-badge.js) — the old toolbar UI is never shown; the
  badge opens the sidebar directly (commit e6f50f7). The rewrite chip reads
  `getActiveMode()`, which falls back to `'Humanize'` because the toolbar
  never sets state.
- `_onDoubleClick` synonyms (content-synonyms.js) — double-click was
  deliberately disabled (commit 6e2f882, unwanted top-left popup). Double-
  clicking a word must **not** open anything.

If this pass is green, the audit's last extension risk is retired and the
Chrome Web Store submission (STORE.md) can proceed.
