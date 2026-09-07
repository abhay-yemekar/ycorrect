# Extension smoke test — real-browser pass (AUDIT.md item F / roadmap "Next-4")

This is the manual checklist for the audit's highest-risk open item: verifying
the extension end-to-end in a real browser. Human results are required by the
audit brief. Chrome is connected, but the browser tool blocks chrome://extensions;
automated DOM doubles do not establish Chrome loading or host-site compatibility.

**Why this exists:** PROGRESS.md has a history of shipping "underline fixed for
ChatGPT/ProseMirror" fixes that were never confirmed in a browser. This pass
is the verification gate those fixes (and the content-script split) need.
Every row should be answered — no blanks. "Counted, not estimated."

---

## 0. Prerequisites

1. Start the server: `npm start` (http://localhost:3000). Confirm
   `http://localhost:3000/api/health` returns 200 with a version.
2. Load the extension unpacked in Chrome:
   - Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `apps/extension/`.
3. Open the extension's **Options** page (right-click the toolbar icon →
   **Options**). Confirm the default server URL is `http://localhost:3000`.
4. Have a Gemini key in the repository-root `.env` (`GEMINI_API_KEY`) if you want to test
   AI rewrite; grammar + synonyms work without it (LanguageTool is public).
5. **Post-split sanity (NEW — most important check this round):** visit any
   plain page with a text field (see §1). Open DevTools console. There must be
   **no** errors — specifically no `ReferenceError`, no
   `Identifier '…' has already been declared`. The seven content parts load in
   order into one isolated world; any error here means the split is broken.

## 1. Local test page (fastest, most reliable)

The committed fixture
`tests/unit/fixtures/extension-smoke.html` contains only synthetic writing and
empty credential fields. The server's static root is `apps/web/`, so it does
not serve the tests tree; copy the fixture in for the session (and remove it
afterwards) or serve the tests tree separately on another port:

```bash
# option A: session copy (matches the server's CORS + content-script matches)
cp tests/unit/fixtures/extension-smoke.html apps/web/extension-smoke.html
# open http://localhost:3000/extension-smoke.html ; delete the copy afterwards

# option B: separate static server on another port (then allow that host in
# apps/extension/manifest.json host_permissions if the extension must reach it)
python3 -m http.server 8787 --directory tests/unit
# open http://localhost:8787/fixtures/extension-smoke.html
```

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
| Apply | Choose a replacement, then Accept in the review | Original/suggestion shown before replacement; Undo available afterward | Replacement without review; wrong text replaced |
| Fix All | Open sidebar → Fix All → review → Accept | Non-overlapping fixes previewed together; batch undo available | Silent apply; wrong text replaced; overlapping alternative applied |
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

### Flagship regression queue (2026-09-05)

These are pending human checks, not claimed outcomes. Only a human browser run
may replace NOT RUN with PASS/FAIL and record date, browser/version and evidence.

| ID | Steps / expected result | Human result |
|---|---|---|
| T01 | Start server and look up a word in web app; confirm live synonyms still appear. Automated tests now stub DataMuse and assert fixture contents. | NOT RUN |
| U01 | Humanize sentence, selection rewrite, grammar chip and Fix All must show original/suggestion with Accept/Reject; rejection leaves text untouched; Accept then Undo restores only reviewed edits. Switch selections/fields or type while awaiting results: stale work must not apply. Test rich formatting, React inputs, empty replacements and overlapping fixes. | NOT RUN |
| H01/W01 | Reload extension, inspect console, type repeated misspellings across formatted text nodes in ChatGPT/ProseMirror. Edit or switch fields while a grammar request is pending. Only matching text snapshots may render. Recreate nodes without changing text; ranges still underline the correct occurrence. | NOT RUN |
| E01 | Stop the server, request grammar/rewrite, then simulate 429/503. An explicit error appears, no false clean result or silent replacement; restart and retry. | NOT RUN |
| S01 | Popup: disable current site while requests are pending, then re-enable without reload. All UI disappears while disabled and pending responses cannot restore it. Toggle grammar from options: requests/highlights stop, and resume when enabled. | NOT RUN |
| L01 | Type continuously, then pause: one grammar request for the final text. Leave unchanged through polling: no repeats. Short/empty fields leave no spinner. Rewrite shows Preparing rewrite and Cancel; cancel prevents late preview; errors clear loading and allow retry. | NOT RUN |
| K01 | With review open and focus in its editor or card, Ctrl+Alt+Enter accepts; Escape rejects/closes; Ctrl+Alt+Z undoes. Plain Ctrl+Z remains native; IME composition and unrelated focused fields must not be intercepted. Tab to review buttons and activate them. | NOT RUN |
| Z01 | Build ZIP, extract it and load extracted directory unpacked; manifest/assets load with no errors. Automated ZIP checks now validate stored CRCs against contents and known CRC vectors. Node 18 runtime pass remains separate from local Node 24 verification. | NOT RUN |
| O01 | Set server URL to another localhost port. Open app from popup must use that URL, consistent with health checks. Restore original URL afterward. | NOT RUN |
| B01 | Compare README, web title, extension popup/options, context menu and store draft: all public product names are WriteRight. Repository slug, package name and YCORRECT_* keys intentionally remain compatibility identifiers. | NOT RUN |
| U02 | Select text in textarea/input with mouse and keyboard: Rewrite appears and preserves the exact selected whitespace/range. While a changed draft is being checked, an old grammar card must refuse acceptance. | NOT RUN |
| M01 (§0.2 gate) | Load `apps/extension/` unpacked after the git move. Confirm popup/options open, content scripts inject and DevTools shows no load or duplicate-declaration errors. Required before moving another folder under the audit brief. | NOT RUN |

Fill this in; commit it back to PROGRESS.md when complete.

| Date | Site/field | Badge | Underlines | Sidebar | Fix | Rewrite | Console errors? |
|---|---|---|---|---|---|---|---|
| 2026-09-06 | All requested sites/fields | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT CHECKED |

### Shutdown checkpoint

The owner answered **Not checked yet** for M01. No human PASS or FAIL has been
reported. All original checks in sections 0–7 and regression rows above remain
NOT RUN. Full smoke state: **INCOMPLETE**, not passed. Automated results belong
in PROGRESS.md and GAP_REPORT.md, not in the human-result columns.

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
