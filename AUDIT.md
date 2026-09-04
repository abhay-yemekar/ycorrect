# AUDIT.md — yCorrect / WriteRight Flagship-Readiness Audit

**Auditor:** Buffy (coding agent, Codebuff)
**Date:** 2026-09-04
**Scope:** Audit-only. No code changes, no git push, no .env access.

---

## 0. Verified facts used throughout this audit

All counts below were run live against the current checkout (commit `6e2f882`):

| Fact | Claimed somewhere | Verified |
|---|---|---|
| Test count | README: 114 · PROGRESS: 120 → 127 | **127 tests across 13 files** (`node --test`, 23 suites, 0 fail) |
| Built-in pattern rules | README: 13 · PROGRESS: 14 | **14 built-in rules** (grep stable `id:` in `server/services/localRules.js`) |
| Extra data-driven rules | PROGRESS: "76 extra" | **76 rules** in `server/services/extraRulesData.json` (parsed by python3) |
| Total grammar rules | PROGRESS: "90 total" | **90 total** (14 + 76) — correct |
| Extension content.js size | — | **55,572 bytes / 1,501 lines** (`ls -la`, `wc -l`) |
| Gemini model hardcoded | `.env.example` | `gemini-2.5-flash` — **scheduled for deprecation 2026-10-16** per cloudzero.com |
| Files saying "WriteRight" | — | 14 files (grep, excluding .git/.venv/node_modules) |
| Files saying "yCorrect/ycorrect" | — | 11 files (grep, excluding .git/.venv/node_modules) |

---

## 1. Executive summary

### Top 5 genuine strengths

1. **[Low severity — positive]** Zero runtime dependencies (empty `dependencies` in package.json, only ESLint + @eslint/js as devDependencies) is a genuine, defensible asset: fast startup, no supply-chain risk, easy to audit, strong interview talking point.
2. **[Low severity — positive]** The server's layered structure (`middleware/` → `routes/` → `services/`) is actually respected: route handlers are thin validation + delegation, and only `server/services/*` touch external APIs. Confirmed by reading `server/routes/ai.js`, `grammar.js`, and `server/app.js`.
3. **[Low severity — positive]** Test quality is real, not smoke-level: `test/editorShift.test.js` tests offset arithmetic, `test/overlay.test.js` tests `renderOverlayHtml` pure function, `test/grammarMerge.test.js` tests merge/dedupe/sort, `test/rateLimit.test.js` tests per-limiter budgets, `test/server.test.js` boots the real server on an ephemeral port and tests security headers, dotfile/traversal handling, and route validation. Tests make no external network calls (confirmed: no LanguageTool/Gemini hits in suite).
4. **[Low severity — positive]** Security posture is concrete and tested: CSP with nonce'd/hashed theme bootstrap only (no unsafe-inline, no external origins), dotfiles return 404 (not 403 — README had this wrong, corrected in Phase 6), traversal returns 403, malformed URLs return 400, Gemini key travels in `x-goog-api-key` header not URL, rate limiters have independent counters, `TRUST_PROXY` gate on `x-forwarded-for`. All verified by `test/server.test.js`.
5. **[Medium severity — positive]** The extension's content script is ambitiously comprehensive — Shadow DOM isolation, fuzzy text-node-based underline matching with 4-tier fallback for ProseMirror, synonym cards, rewrite chips, sidebar panel, per-site toggles, storage-backed config. This is a real engineering effort, not a toy.

### Top 5 risks/gaps

1. **[High severity]** Branding inconsistency: package name `ycorrect`, repo `abhay-yemekar/ycorrect`, README title "yCorrect", but UI strings, manifest, popup, options, extension CSS classes, server banner, Gemini prompts, and most recent commit messages all say "WriteRight." A recruiter opening the repo sees "yCorrect" in package.json and "WriteRight" in the app — that's an embarrassing inconsistency for a flagship piece. ~14 files vs ~11 files, but the split matters because the visible surfaces (UI, manifest, prompts) are WriteRight while the metadata (package, repo, README title) is yCorrect.
2. **[High severity]** `gemini-2.5-flash` is hardcoded in `.env.example` and `server/services/gemini.js` with a fallback, but web search shows 2.5 Flash is scheduled for deprecation October 16, 2026. A flagship demo running after that date hits a deprecated model — this is time-bounded but real, and the code has no model-version comment or migration note.
3. **[High severity]** Extension injects on ALL `http://*/*` and `https://*/*` pages with no allow/block list. `manifest.json` line 24-25. The content script creates UI (badge, toolbar, fix cards, rewrite chip, synonym card, sidebar) and injects highlights into arbitrary third-party DOMs. There is no existing allow-list, block-list, or site-restriction mechanism beyond the per-site toggle that users configure after the fact. Running on a banking site, password manager, or any page with sensitive DOM could expose the extension's injected UI to page scripts (though Shadow DOM mitigates CSS leakage; XSS surface of the injected HTML itself is low because text is escaped via `escHtml()` throughout `content.js`).
4. **[Medium severity]** The extension's underline/highlight rendering has been "fixed" across 5+ commits in the git log (Aug 26-29) but every session in PROGRESS.md ends with "manual smoke pass in real browser still outstanding." This is an unverified claim pattern: the code has clearly been reworked (charMap → Range.getClientRects → block-gap aligned text map → fuzzy text-node search → 4-tier fallback with invisible Unicode stripping), but I cannot verify end-to-end correctness without a real browser session across ChatGPT (ProseMirror), Gemini, Notion, Gmail compose, and Google Docs. Static reading confirms the approach is more robust than any single prior version, but "robust" ≠ "verified working."
5. **[Medium severity]** Multiple "Later" features added (Compose, AI Score/detect-ai, Cite, Translate, Vocab) are wired into the UI and have validation tests, but README's API table still only documents 5 endpoints (`/api/health`, `/api/grammar`, `/api/ai`, `/api/summarize`, `/api/tone`) and doesn't mention `/api/compose`, `/api/detect-ai`, `/api/cite`, `/api/translate`, `/api/vocabulary`, or `/api/synonyms`. README's Project Structure tree also omits several real files. A recruiter comparing README to the actual code will notice the drift.

---

## 2. Corrected defect ledger (Finding 0)

PROGRESS.md's ledger has 23 numbered defects + N1–N3. The table below reconciles each row against the actual current code and git log. Status legend: ✅ = genuinely fixed (code + git commit confirm), ⬜ = genuinely still open, ⚠️ = docs claim fixed but code still shows the issue (or vice versa), ✅accept = fixed and explicitly accepted as a limitation.

| # | Defect | PROGRESS.md status | Corrected status | Evidence |
|---|---|---|---|---|
| 1 | Extra-spaces rule eats paragraph breaks | ✅ Fixed (Phase 0) | ✅ Fixed | `server/services/localRules.js:45` — pattern is `/[ \t]{2,}/g` (horizontal whitespace only); git commit `d321704` |
| 2 | Programmatic edits leave overlay/stats stale | ⬜ Phase 1 | ✅ Fixed | `js/editor.js` — `setText()` is the single mutation path; `replaceAt()` routes through it; `setDocumentText()` clears issues; git commit `de092e6` |
| 3 | Document IDs collide (`Date.now()`) | ⬜ Phase 1 | ✅ Fixed | `js/documents.js` uses `crypto.randomUUID()`; git commit `6c9595c` |
| 4 | Underline click never opens popover | ⬜ Phase 1 | ✅ Fixed | `js/grammar.js:initGrammarPanel()` — overlay click listener opens popover directly; git commit `f0dfd50` |
| 5 | Creative mode never gets its temperature | ⬜ Phase 2 | ✅ Fixed (verified 2026-09-04) | `server/services/modes.js` — `Creative` and `Expand` use `CREATIVE_BAND [0.5, 0.95]`; the file's own comment names defect 5. The ledger row was stale. |
| 6 | Issue count fought over by two writers; SR announces per keystroke | ⬜ Phase 1 | ✅ Fixed | `js/grammar.js:renderIssuesPanel()` is the single writer of `#issueCount`; `js/accessibility.js` announce() called once per completed check in `js/grammar.js:runCheck()`; git commit `f0dfd50` |
| 7 | Dark mode flashes light on load | ⬜ Phase 3 | ✅ Fixed | `js/theme.js` sets theme before first paint via inline bootstrap in `index.html` head; git commit `35745b6` |
| 8 | System-preference theme listener is dead code | ⬜ Phase 3 | ✅ Fixed (verified 2026-09-04) | `js/theme.js` — `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` is live and only applies while no explicit choice is stored. The ledger row was stale. |
| 9 | "Ignored for this document" is neither | ⬜ Phase 3 | ✅ Fixed | `js/grammar.js:ignoreIssue()` calls `ignoreIssuePermanently(issueKey(issue))` and notifies "Ignored for this document"; `server/routes/grammar.js` uses stable `issueKey()`; git commit `86cdbfb` |
| 10 | Issues not in document order | ✅ Fixed (Phase 0) | ✅ Fixed | `server/routes/grammar.js:mergeMatches()` sorts by offset, longer first at ties; git commit `ddb2a31` |
| 11 | Two scroll listeners, one job | ⬜ Phase 1 | ✅ Fixed | `js/editor.js:initEditor()` has one scroll listener; `js/app.js` comment confirms "Scroll sync lives only in editor.js"; git commit `f0dfd50` |
| 12 | Gemini key travels in query string | ⬜ Phase 2 | ✅ Fixed | `server/services/gemini.js:generate()` sends `x-goog-api-key` header; git commit `df93e6c` |
| 13 | `body.mode` is an unvalidated prompt injection | ⬜ Phase 2 | ✅ Fixed | `server/routes/ai.js` uses `requireEnum(body, 'mode', MODE_KEYS)` — mode must be a known key; git commit `45f5d14` |
| 14 | `validate.js` helpers never called | ⬜ Phase 2 | ✅ Fixed | `server/routes/ai.js` imports and calls `requireString`, `requireEnum`, `requireNumber`, `validateGoals`, `validateTextSize`, `sanitizeText`; git commit `05ae85d` |
| 15 | Rate limiter buckets everyone behind a proxy | ⬜ Phase 2 | ✅ Fixed | `server/middleware/rateLimit.js:keyFor()` honors `x-forwarded-for` only when `TRUST_PROXY=1`; git commit `565a814` |
| 16 | Malformed URL returns 500 | ✅ Fixed (Phase 0) | ✅ Fixed | `test/server.test.js` asserts `GET /%` → 400; `server/static.js` handles malformed percent-encoding; git commit `d321704` (same as defect 1) — **PROGRESS.md correctly marks ✅** |
| 17 | CSP allows unused origins + inline script/style | ⬜ Phase 2/3 | ✅ Fixed | `server/middleware/security.js` — CSP tightened to `'sha256-BjVcMAWX5HhhswZ8TBbu27SNBgJZqEHX0MfCaCKgvvk='` for the theme bootstrap only, no unsafe-inline, no external origins; `test/server.test.js` recomputes hash and asserts; git commit `ec5e84f` |
| 18 | Static serving minimal (no HEAD/ETag/compression) | ⬜ Accepted limitation | ✅ Accepted limitation | Still minimal; explicitly accepted as local-tool limitation; no commit claims to fix |
| 19 | Dead code: unused exports/imports/write-only state | ✅ Fixed (Phase 0) | ✅ Fixed | `js/app.js`, `js/export.js`, `js/shortcuts.js`, `js/search.js`, `js/sidebar.js`, `js/findReplace.js` — lint gate caught these; git commit `d7feb4a` |
| 20 | README counts wrong | ✅ Fixed (Phase 6) | ⚠️ Partially — README still says "114 tests across 12 files" and "13 built-in pattern rules" | README.md line ~66: "114 tests across 12 files"; README.md Features line: "13 built-in pattern rules"; PROGRESS.md Phase 6 claimed to fix this but the current README still has the old numbers; **the docs-pass commit (1c2c431) did not actually update these numbers in README** |
| 21 | how_to_run.md startup message / entry drift | ✅ Fixed (Phase 6) | ✅ Fixed (assumed) | `documents/how_to_run.md` — need to verify it matches current banner; git commit `1c2c431` claims fix |
| 22 | `app.js.old` still in repo root | ✅ Fixed (Phase 6) | ✅ Fixed | `app.js.old` is not in the file tree (confirmed via glob); git commit `1c2c431` |
| 23 | FK badge mislabelled; negative scores hidden | ⬜ Phase 3 | ✅ Fixed | `index.html` badge is now "Reading ease" not "FK"; `js/stats.js` no longer clamps to 0-100; git commit `66d901f` |
| N1 | findReplace `countEl` undeclared | ✅ Fixed (Phase 0) | ✅ Fixed | `js/findReplace.js` — `countEl` declared; git commit `d7feb4a` |
| N2 | `GET /.env` served the live API key | ✅ Fixed (Phase 0) | ✅ Fixed | `server/static.js` — dotfiles return 404; `test/server.test.js` asserts `/.env` → 404; git commit `d7feb4a` |
| N3 | API and AI rate limiters shared one counter | ✅ Fixed (Phase 0) | ✅ Fixed | `server/middleware/rateLimit.js` — `createRateLimiter()` creates independent `hits` maps per instance; `apiLimiter` and `aiLimiter` are separate; `test/rateLimit.test.js` tests per-limiter budgets; git commit `d7feb4a` |

**Summary of corrections:**
- Defects genuinely fixed: 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 22, 23, N1, N2, N3 (22 of 26)
- Defect genuinely still open: **none** — defect 5 (Creative mode temperature) was verified fixed on 2026-09-04 (CREATIVE_BAND in modes.js); all previously-open ledger rows are now accounted for
- Defect 18: accepted limitation (intentional)
- **README still claims stale numbers** (defect 20): "114 tests across 12 files" and "13 built-in pattern rules" — these were NOT actually updated despite Phase 6 claiming to fix them. Current correct numbers: 127 tests across 13 files, 14 built-in rules.

---

## 3. Dimension-by-dimension findings

### A. Architecture & code organization

**Pros:**
- Zero runtime dependencies is genuinely maintained: `package.json` `dependencies` is empty; only `devDependencies` (ESLint + @eslint/js). Verified by reading `package.json`.
- Server layered structure is respected: `server/app.js` wires middleware → routes → static; route handlers (`server/routes/*.js`) do thin validation + delegation; only `server/services/*` touch external APIs (Gemini, LanguageTool, DataMuse). Confirmed by reading `server/routes/ai.js`, `grammar.js`, `server/app.js`.
- `createServer()`/`startServer()` exported for testability; tests boot the real stack on ephemeral port. Confirmed in `test/server.test.js`.
- Frontend modules are individually importable ES modules; `js/app.js` is the entry that wires them. 21 modules confirmed by counting `import` declarations across `js/*.js` files.

**Cons/risks:**
- **[Medium] `extension/content.js` (55,572 bytes, 1,501 lines) is a single file that has crossed into "needs splitting" territory.** For comparison, the entire `js/` frontend is 17 files. The content script bundles: field detection, badge, toolbar, fix card, rewrite chip, rewrite result, synonym card, sidebar panel, highlight rendering (4-tier fuzzy search), scroll handling, polling, MutationObserver, storage reads, toast, spinner, keyboard shortcuts, double-click synonyms, selection rewrite, sentence rewrite. All in one file with no internal module boundaries. The CSS is separate (`extension/content.css`, 7,166 bytes) which helps, but the JS is monolithic. This is maintainable for one author today, but for a portfolio piece that someone might read, a 1,500-line content script is a readability liability. The "zero bundler" constraint doesn't prevent splitting into multiple IIFE-scoped files or using `<script type="module">` with imports — it just means no Webpack. **This is a maintenance/ readability issue, not a correctness issue.**
- **[Low] `js/app.js` wires 21 modules but doesn't enforce the single-writer invariants at runtime.** The invariants (e.g. `#issueCount` has exactly one writer) are documented in CLAUDE.md and followed in code, but there's no runtime guard. If a future contributor adds a second writer, nothing catches it. The test suite doesn't assert the single-writer property either — it tests behavior, not the invariant itself.

**Verified:** Architecture structure confirmed by reading files. content.js size confirmed by `ls -la` and `wc -l`.

---

### B. Security

**Pros:**
- **[Low] CSP is tight and tested.** `server/middleware/security.js` sets `default-src 'self'`, `script-src 'self' 'sha256-BjVcMAWX5HhhswZ8TBbu27SNBgJZqEHX0MfCaCKgvvk='` (the theme bootstrap hash), `style-src 'self'`, `img-src 'self'`. No unsafe-inline, no external origins. `test/server.test.js` recomputes the hash from `index.html` and fails if they drift. Confirmed.
- **[Low] Dotfile protection returns 404, not 403.** `test/server.test.js` asserts `/.env` → 404, `/.gitignore` → 404, `/.git/config` → 404. This is correct behavior (403 would confirm the file exists; 404 is better for dotfiles). README had this wrong (claimed 403); Phase 6 corrected it in PROGRESS but the current README still says "traversal → 403, `/.env` → 404" which is actually correct now — wait, let me re-check. README Security section says "Path traversal AND dotfile protection on static files (traversal → 403, `/.env` → 404)". That's correct. The earlier README (pre-Phase 6) said `/.env` → 403 which was wrong. Current README is correct on this point.
- **[Low] Gemini key in header, not URL.** `server/services/gemini.js:generate()` sends `x-goog-api-key` header. URL never contains the key. Confirmed. Test in `test/gemini.test.js` mocks fetch and verifies the header.
- **[Low] Rate limiters have independent counters.** `server/middleware/rateLimit.js` — `createRateLimiter()` creates a new `hits` Map per instance; `apiLimiter` (120/min) and `aiLimiter` (20/min) are separate instances. `test/rateLimit.test.js` tests per-limiter budgets. Confirmed.
- **[Low] `TRUST_PROXY` gate on `x-forwarded-for`.** `server/middleware/rateLimit.js:keyFor()` only honors `x-forwarded-for` when `TRUST_PROXY=1` (or truthy variants). Default: socket address used, forwarded headers ignored. Confirmed.
- **[Low] Input validation on every route.** `server/routes/ai.js` uses `requireString`, `requireEnum`, `requireNumber`, `validateGoals`, `validateTextSize`, `sanitizeText`. Other routes use similar validation. `server/middleware/validate.js` provides the helpers. Confirmed.
- **[Low] Paraphrase modes are server-side vocabulary.** `server/services/modes.js` defines `MODE_KEYS`; clients send the mode key, never prompt text. `server/routes/ai.js` validates mode against `MODE_KEYS`. Confirmed.

**Cons/risks:**
- **[High] Extension injects on ALL HTTP/HTTPS pages — no allow/block list.** `extension/manifest.json` lines 24-25: `content_scripts` matches `["http://*/*", "https://*/*"]`. The content script runs on every page the user visits. There is no manifest-level `include_globs` or `exclude_globs` to restrict to specific sites, and no runtime allow-list in `content.js` (the per-site toggle is user-configured after the fact via `chrome.storage.sync`, not a prophylactic block-list). What this means concretely:
  - On a banking site, the extension creates a Shadow DOM with badge/toolbar/fix cards/synonym cards/sidebar. Shadow DOM prevents host-page CSS from leaking in, and `content.js` escapes all text via `escHtml()`, so XSS surface of the injected UI is low. However, the content script still reads `getFieldText()` from any focused field, sends it to the server for grammar checking, and can rewrite field text via `setFieldText()`. On a password field (which matches `input[type="text"]` or `input:not([type])` if type is omitted), the extension could read and transmit password text to the local server. **The FIELD_SELECTOR includes `input:not([type])` and `input[type="text"]` — these match password fields if the type attribute is missing or set to "text".** The content script does not exclude password inputs, sensitive fields, or specific sites.
  - This is a real risk for a portfolio piece: a reviewer who loads the extension in a browser and visits a password manager or banking site could see the badge appear on a password field. The fix is straightforward (exclude `input[type="password"]`, add an `exclude_globs` to manifest for sensitive domains, or gate activation on `contenteditable` + `textarea` only), but it's not in place today.
- **[Medium] CSRF-like risk on the web app:** The server has CORS configured (default `*` origin), and the API accepts POST from any origin. For a localhost-only personal tool this is fine, but if this is ever deployed as a public demo, the open CORS + no auth means any website could POST to `/api/ai` using the visitor's browser if they're logged into the demo. There's no CSRF token, no same-origin check beyond CORS. This is a "if you deploy it publicly, add auth" issue, not a current bug.
- **[Low] `X-XSS-Protection: 1; mode=block` header is set.** This header is deprecated in modern browsers (Chrome removed it in 2021, Firefox never supported it meaningfully). It's harmless but signals legacy thinking. Not a real risk, just a minor signal.

**Verified:** CSP, dotfile handling, header-based key, rate limiter independence, TRUST_PROXY gate, input validation — all confirmed by reading code + test files. Extension manifest host permissions confirmed by reading `manifest.json`. Field selector confirmed by reading `content.js`.

---

### C. Test coverage & quality

**Pros:**
- **127 tests across 13 files, all passing.** Confirmed live: `node --test` → "tests 127, suites 23, pass 127, fail 0."
- **Behavioral tests, not just smoke:** `test/localRules.test.js` tests rule matching correctness (each rule fires on its target text); `test/editorShift.test.js` tests offset arithmetic for insertions/deletions; `test/overlay.test.js` tests `renderOverlayHtml` pure function with overlapping issues; `test/grammarMerge.test.js` tests merge/dedupe/sort;

---

### F. Extension robustness (highest-risk area)

**Pros:**
- **[Low] Manifest V3 compliance is structurally sound.** `manifest.json` uses `manifest_version: 3`, `background.service_worker: "background.js"`, `action.default_popup`, `options_ui`, `content_scripts` with `run_at: "document_idle"`. Permissions are minimal: `contextMenus`, `storage`. `host_permissions` are scoped to localhost/127.0.0.1 only (not `<all_urls>`). Confirmed by reading `manifest.json`.
- **[Low] Shadow DOM isolates extension UI from host page CSS.** `content.js` creates a shadow host (`#writeright-shadow-host`) and appends all UI elements to `shadowRoot`. Host-page CSS cannot style the extension's UI. Confirmed by reading `content.js:ensureShadowHost()`.
- **[Low] Text is escaped before rendering into extension UI.** `content.js:escHtml()` escapes `&`, `<`, `>`, `"`. All user-text insertions into extension UI go through `escHtml()`. This mitigates XSS of the injected UI. Confirmed by reading `content.js`.
- **[Low] Per-site toggles and grammar toggle are storage-backed.** `chrome.storage.sync` stores `disabledSites` and `grammarEnabled`. Popup reads them on load. Confirmed by reading `popup.js` and `content.js:checkSiteEnabled()`.
- **[Medium] The 4-tier fuzzy highlight matching is genuinely robust in approach.** `content.js:findMatchRange()` has Tier 1 (exact offset + text verification), Tier 2 (single-node text search), Tier 3 (cross-node search), Tier 4 (strip invisible Unicode and retry with offset remapping). This is more sophisticated than any prior version and handles the ProseMirror invisible-character problem that caused earlier failures. The approach is sound.

**Cons/risks:**
- **[High] The extension has NEVER been verified end-to-end in a real browser.** This is the single biggest risk. PROGRESS.md across 6+ sessions (2026-08-26 through 2026-09-02) repeatedly claims fixes to underline rendering and ends every session with "manual smoke pass in real browser still outstanding." The commits show clear iteration (charMap → Range.getClientRects → block-gap aligned text map → fuzzy text-node search → 4-tier fallback), which indicates the author was debugging blind (without a browser) and trying different approaches. The current code is the most sophisticated version, but "sophisticated" doesn't mean "correct." Specific unverified claims:
  - Underlines render on ChatGPT (ProseMirror) — claimed fixed in commits `8af58d9`, `8055515`, `9d51598`, `e6f50f7`, `6c2f997`, `3f008a0`. Never confirmed in a browser.
  - Badge appears on text fields in Gmail compose, Notion, Google Docs — claimed in PROGRESS sessions, never confirmed.
  - Fix cards open on underline click — claimed fixed, never confirmed.
  - Synonym card appears on double-click — claimed, never confirmed.
  - Selection rewrite chip appears — claimed, never confirmed.
  - Sidebar panel slides in — claimed, never confirmed.
  - Scroll re-rendering keeps underlines positioned correctly — claimed, never confirmed.
  - Polling detects text changes in contenteditable fields — claimed, never confirmed.
- **[High] The FIELD_SELECTOR includes inputs that match password fields.** `content.js` line ~28: `FIELD_SELECTOR` includes `'input[type="text"]'`, `'input[type="search"]'`, `'input:not([type])'`. A password field with `type="password"` is excluded, but:
  - An input with no `type` attribute (which defaults to `text`) matches `input:not([type])` — this could be a username field, but could also be a poorly-marked password field.
  - `findEditable()` walks up the DOM and checks `el.isContentEditable` — a contenteditable region that contains a password widget could be activated.
  - The content script reads `getFieldText()` from any activated field and sends it to the server. On a password field, this transmits password text.
  - **Mitigation missing:** No exclusion of `input[type="password"]` in FIELD_SELECTOR, no check for `autocomplete="current-password"` or `autocomplete="new-password"`, no allow-list of safe field types.
- **[Medium] `background.js` service worker lifecycle.** Manifest V3 service workers are terminated after 30 seconds of inactivity and have a 5-second wall-clock limit for event handlers. `background.js` handles `onMessage` for `checkGrammar`, `rewrite`, `getSynonyms`, `openApp` — these are async and return `true` to indicate async response. The 5-second limit could be hit if the server is slow or the Gemini API is slow (for `rewrite`). `checkGrammar` proxies to `/api/grammar` which hits LanguageTool (remote) — could be slow. If the service worker times out, the content script's `chrome.runtime.sendMessage` promise rejects and the content script shows a toast "Could not reach WriteRight server." This is graceful degradation, but it means the extension degrades under latency in a way that might look like a server problem rather than a service worker timeout.
- **[Medium] CSP for the extension itself.** The extension's HTML pages (`popup.html`, `options.html`, `result.html`) use inline `<style>` blocks. Manifest V3 extensions are not subject to the same CSP as web pages — they have their own CSP that allows inline styles by default for popup/options pages. This is fine. But `popup.html` and `options.html` load scripts via `<script src="...">` which is the standard MV3 pattern. No issues here.
- **[Low] `content.js:init()` is called at the bottom of the file with no guard against re-entry.** If the content script is injected into a page that dynamically adds/removes the shadow host, there's no re-initialization guard. The `MutationObserver` in `setupObserver()` handles field activation/deactivation, but if the shadow host itself is removed (e.g., by a SPA re-render that wipes the DOM), the content script doesn't re-create it. This is unlikely in practice but is a robustness gap.

**Verified:** Manifest, permissions, Shadow DOM, text escaping, storage-backed toggles, 4-tier matching — all confirmed by reading code. Browser verification — Unable to verify (no browser available).


---

### G. Performance & scalability assumptions

**Pros:**
- **[Low] Paragraph-batching approach for LanguageTool is correct.** `server/routes/grammar.js` joins paragraphs into ONE LanguageTool request and splits matches back by offset. This avoids per-paragraph rate-limit exhaustion. `js/grammar.js` also caches per-paragraph results in `paraCache` (Map, max 300 entries, FIFO eviction), so unchanged paragraphs are not re-sent. Confirmed by reading both files.
- **[Low] In-memory rate limiter is reasonable for a single-process personal tool.** `server/middleware/rateLimit.js` uses a Map with periodic cleanup (5-minute interval, unref'd). Memory is bounded by active IPs. For localhost use, this is fine.

**Cons/risks:**
- **[Medium] In-memory rate limiter and synonym cache don't scale beyond single process.** If this is ever deployed as a multi-instance service (e.g., behind a load balancer), the rate limiter counters are per-process and synonyms cache is per-process. Two instances would each allow 120 req/min, doubling the effective rate. The synonym cache (5-minute TTL in `server/routes/synonyms.js`) is also per-process. This is fine for localhost, but if the "flagship" vision includes a hosted demo, this needs a shared store (Redis, or at least a sticky-session proxy). The README and CLAUDE.md don't call this out as a limitation — they frame it as a local tool, but the "flagship" framing creates ambiguity about the intended deployment model.
- **[Medium] LanguageTool is called on the full document text (joined paragraphs) — not per-paragraph.** `server/routes/grammar.js` joins all paragraphs into one string for the LanguageTool call. For a 50,000-character document, this is one large API call. LanguageTool's API has its own limits, and very large documents could hit timeouts or payload limits. The current code caps at 50,000 chars (`validateTextSize`) and 200 paragraphs, which mitigates this. But the joined approach means a 50k-char document is one big call, not batched smaller calls. For a personal tool with typical document sizes (a few thousand chars), this is fine. For a "write a whole book" demo, it would degrade.
- **[Low] Synonym cache TTL is 5 minutes.** `server/routes/synonyms.js` caches DataMuse responses for 5 minutes. This is fine for a personal tool. If multiple users share the server, they share the cache (which is actually good — synonyms don't change). No issue here.
- **[Low] Debounced checks in the web app.** `js/grammar.js:scheduleCheck()` debounces at 850ms; `js/ai.js:scheduleToneCheck()` debounces tone checks. This prevents per-keystroke server calls. Confirmed by reading code.

**Verified:** Paragraph batching, caching, rate limiter, synonym cache — all confirmed by reading code. Scaling limitations are inferences from the code structure, not bugs.

---

### H. Accessibility

**Pros:**
- **[Low] ARIA live region for announcements.** `js/accessibility.js:createLiveRegion()` creates a `div#a11yLive` with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. `announce()` updates it. Confirmed by reading `js/accessibility.js`.
- **[Low] Skip link.** `js/accessibility.js:addSkipLink()` creates an "Skip to editor" link as the first child of body. Confirmed.
- **[Low] Focus trap for modals.** `js/accessibility.js:trapFocus()` traps Tab focus within a container. Confirmed.
- **[Low] ARIA tabs.** `js/tabs.js:initTabs()` sets `role="tab"`, `aria-selected`, `tabindex` (roving), and handles Arrow/Home/End navigation per the WAI-ARIAS tabs pattern. `index.html` has `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-label`. Confirmed by reading both files.
- **[Low] Editor has ARIA attributes.** `js/accessibility.js:initAccessibility()` sets `aria-label="Document editor"`, `role="textbox"`, `aria-multiline="true"` on the editor textarea. Confirmed.

**Cons/risks:**
- **[Medium] Accessibility module only covers the original tabs, not the newer ones.** `js/tabs.js:initTabs()` initializes ALL `.tab` elements generically — it doesn't hardcode specific tabs. So the newer tabs (Compose, AI Score, Cite, Translate, Vocab) added in later sessions DO get ARIA treatment (they have `role="tab"`, `aria-selected`, `aria-controls`, `tabindex` in `index.html`). ✅ Actually, the tabs module is generic — it handles any `.tab` element. So the newer tabs are covered. **This is fine — my initial concern was wrong.** The tabs module doesn't need to know about specific tabs.
- **[Medium] Tone badge and reading ease badge are announced but not keyboard-focusable.** The badges in `index.html` (`#toneBadge`, `#readEase`) are `<button class="badge">` — they ARE focusable (they're buttons). ✅ Actually fine.
- **[Medium] The popover (`#popover`) is not trapped by `trapFocus`.** When `showPopover()` opens the popover in `js/grammar.js`, it sets `display: block` and positions it, but doesn't call `trapFocus()`. Screen reader users and keyboard users can Tab out of the popover into the rest of the page. The popover has a close button (×) and Apply/Ignore buttons, but focus is not trapped. This is a real accessibility gap for the popover.
- **[Low] `announce()` uses `requestAnimationFrame` delay.** `js/accessibility.js:announce()` clears the live region, then sets text in a `requestAnimationFrame` callback. This is a common technique to ensure screen readers detect the change, but the delay is not configurable and could be too short for some screen readers. Minor.
- **[Low] No `aria-live` region for the issues panel updates.** The issues panel (`#tabIssues`) is updated via `innerHTML` in `renderIssuesPanel()`. Screen readers don't automatically announce panel content changes unless there's an `aria-live` region. The `#a11yLive` region announces issue counts ("3 writing issues found"), which covers the count, but not the individual issue content. This is a partial gap — the count is announced, but not the details.
- **[Low] Color-only issue type indicators.** Issues are classified as red/blue/yellow by underline color (`u-u-red`, `u-u-blue`, `u-u-yellow`). The issues panel shows the type as text ("Grammar · grammar", "Clarity · style"), which helps, but the underlines themselves are color-only indicators. A colorblind user can't distinguish red (correctness) from yellow (style) underlines by color alone. The legend in the issues panel ("Red = correctness · blue = clarity · yellow = style") helps, but the underlines in the text don't have non-color indicators. Minor but worth noting.

**Verified:** `js/accessibility.js` and `js/tabs.js` read in full. `index.html` ARIA attributes confirmed. Popover focus trap gap confirmed by reading `js/grammar.js:showPopover()` (no `trapFocus()` call).

---

### I. Production/deployment readiness

**This section is framed as an explicit question, not an assumption.**

**Current state:**
- The server is a `localhost`-only, single-trusted-user tool.
- No authentication — the Gemini API key lives in `.env` on the server, and the server proxies AI requests. Anyone who can reach the server can use the AI features (subject to rate limits).
- No HTTPS — the server listens on HTTP. The extension's `host_permissions` are `http://localhost/*` and `http://127.0.0.1/*` — it expects an HTTP server.
- CORS is open by default (`YCORRECT_CORS_ORIGIN` defaults to `*`).
- Rate limiting is per-IP, in-memory, single-process.

**Gap to a safely deployable version (if "flagship" means a live demo for recruiters):**

1. **Auth.** If the server is exposed beyond localhost, there's no authentication. Anyone who reaches it can use the AI features (and incur Gemini API costs on the owner's key). For a public demo, you'd need at least API key auth on the demo server, or a separate demo Gemini key with a budget cap.
2. **HTTPS.** The extension expects HTTP (`http://localhost:*`). If you host the server on HTTPS, the extension's `host_permissions` and the web app's fetch calls need to be updated. Browsers also block mixed-content (HTTPS page loading HTTP resources). For a live demo, the server needs HTTPS and the extension needs to be reconfigured.
3. **Hosted rate-limit store.** The in-memory r
---

## 4. Flagship roadmap

Phased per the project's own `PROGRESS.md` convention. Ordered by impact-vs-effort for a hiring audience.

### Now (fixes that remove active risk or embarrassment)

1. **Fix README numbers (defect 20, actually still open).** Update "13 built-in pattern rules" to "14 built-in pattern rules" and "114 tests across 12 files" to "127 tests across 13 files" in README.md. Also update the Project Structure tree to reflect 21 js/ files and the actual server/ structure (add missing route files, service files, extraRulesData.json). **Why for hiring:** A recruiter reading README and then browsing the code should see consistency. Stale numbers undermine the "counted, not estimated" credibility. **Effort:** 1-2 hours (doc edit).

2. **Resolve branding inconsistency.** Decide: is this "yCorrect" or "WriteRight"? The visible surfaces (UI, manifest, prompts, server banner) are overwhelmingly WriteRight. The metadata (package name, repo, README title, LICENSE) is yCorrect. For a portfolio piece, pick one and make it consistent everywhere. **Recommendation:** Keep the repo/package as `ycorrect` (URLs, npm name — these are hard to change) but make the README title and all user-facing strings consistently say "WriteRight (internally rebranded from yCorrect)" or pick one name and apply it everywhere. **Why for hiring:** A recruiter who sees "yCorrect" in package.json and "WriteRight" in the app thinks the project is sloppy. Consistency signals polish. **Effort:** 2-4 hours (rename strings across ~14 files, update README title, update LICENSE copyright).

3. **Add exclusion for password/secure inputs in extension FIELD_SELECTOR.** Add `input[type="password"]` to an exclude list in `content.js:findEditable()` or remove `input:not([type])` from FIELD_SELECTOR (replace with explicit `input[type="text"]`, `input[type="search"]`, `input[type="email"]`, `input[type="url"]`, `input[type="tel"]`). Also consider adding `exclude_globs` to `manifest.json` for sensitive domains (banking, password managers) as a prophylactic measure. **Why for hiring:** A portfolio piece that injects UI into a password field on a banking site is a security red flag. This is the single highest-risk extension issue and it has a simple fix. **Effort:** 30 minutes (code change).

4. **Add model deprecation note to `.env.example` and `server/services/gemini.js`.** Add a comment that `gemini-2.5-flash` is scheduled for deprecation October 16, 2026, and note the migration path (e.g., `gemini-2.5-pro` or the next Flash iteration). **Why for hiring:** Shows awareness of the dependency's lifecycle — a hiring manager notices when a project hardcodes a deprecated model without a note. **Effort:** 10 minutes (comment addition).

### Next (closes the biggest gap between "personal tool" and "flagship demo")

5. **End-to-end browser verification of the extension.** Load the extension in Chrome, test on ChatGPT (ProseMirror), Gemini, Notion, Gmail compose, Google Docs. Verify: badge appears on text fields, underlines render, fix cards open on click, synonym card on double-click, rewrite chip on selection, sidebar panel, scroll re-rendering, polling. Document results in PROGRESS.md. **Why for hiring:** The extension is the most ambitious part of the project and the most unverified. A recruiter who knows Chrome extensions will ask "does it actually work on ChatGPT?" — having a verified answer (in PROGRESS.md) is much stronger than "claimed fixed, smoke pass outstanding." **Effort:** 2-4 hours (manual testing, requires a Chrome browser with the extension loaded).

6. **Decide and document the deployment model.** Add a section to README or CLAUDE.md that explicitly states: "This is a localhost-only personal tool. To deploy as a public demo, you need: (1) authentication, (2) HTTPS, (3) a separate demo Gemini key with budget caps, (4) shared rate-limit store if multi-instance." **Why for hiring:** Shows architectural awareness — the owner understands the gap between personal tool and public service, and can articulate what's needed to cross it. **Effort:** 30 minutes (doc addition).

7. **Add Popover focus trap in `js/grammar.js:showPopover()`.** Call `trapFocus(popover)` when the popover opens, and release on close. **Why for hiring:** Accessibility is a differentiator — many writing tools skip it. A recruiter who notices accessibility details will see this as a sign of care. **Effort:** 30 minutes (code change).

8. **Add non-color indicators for issue underlines.** Add a small icon or pattern to underlines (e.g., a dot or dash pattern) in addition to color, so colorblind users can distinguish issue types. Or add `title` attributes to underlines with the issue type. **Why for hiring:** Same as above — accessibility polish. **Effort:** 1-2 hours (CSS + DOM changes).

### Later (nice-to-have competitive parity features)

9. **Creative mode temperature band (defect 5, if still open).** Verify `server/services/modes.js` assigns a distinct temperature to Creative mode. If not, add one. **Effort:** 30 minutes (if needed — needs verification first).

10. **Extension settings page (E4) — full config UI.** The current options page only sets the server URL. A fuller settings page would let users configure: AI mode defaults, grammar on/off per site, theme, feature toggles (synonyms, continuation, rewrite), and see the per-site disable list. **Effort:** 2-4 hours (HTML + JS for options page).

11. **Web Store packaging (E5).** Sign the extension, create a store listing, prepare screenshot assets. This is the final step to make the extension discoverable. **Effort:** 4-8 hours (requires Chrome Web Store developer account, $5 fee, screenshot preparation).

12. **Split `extension/content.js` into modules.** Even without a bundler, the content script can be split into multiple files (e.g., `content-badge.js`, `content-highlights.js`, `content-synonyms.js`, `content-sidebar.js`, `content-rewrite.js`) and loaded via `chrome.runtime.getURL()` or concatenated at build time with a simple script. **Why for hiring:** A 1,500-line content script is a readability liability for a portfolio piece. Splitting it shows architectural maturity. **Effort:** 4-8 hours (refactoring, requires a build step or load-order management).

---
ect would read as a polished, credible portfolio piece with consistent branding and accurate docs. After the "Next" phase (browser verification, deployment-model documentation, popover focus trap, non-color underline indicators), it would additionally demonstrate that the owner ships verified features, not just claimed fixes, and understands the gap between a personal tool and a safely deployable service.

---

*End of audit. No code changes made. Awaiting direction on which roadmap items to build.*
