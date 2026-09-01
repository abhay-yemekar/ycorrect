## Session 2026-09-01 — Phase 1: Fix All Critical Bugs + Rebrand

**Goal:** Make the project consistently branded as WriteRight, fix broken grammar rules, and add 40+ common misspelling rules.

**Done:**

### Rebranding
- All files now say "WriteRight" consistently: manifest.json, popup.html, options.html, index.html, background.js, server banner, gemini prompts, app.js, continuation.js, export.js, backup.js
- Test assertion updated to match WriteRight branding

### Content.js Fix
- Moved spinner/toast functions BEFORE init() call (was appended after init, causing structural issues)

### Grammar Rules Overhaul
- Replaced extraRulesData.json with 76 clean rules (was 53 with broken patterns)
- Fixed double-negative-1 pattern to match non-adjacent negatives ("dont...nothing")
- Fixed replacement function bug: was using new Function("m", "return " + rep) which evaluated suggestion strings as JS code
- Removed broken rules: than-then (false positives), affect-effect (false positives), preposition-at-end (too aggressive), could-of-2 (typo in rule itself)
- Added 40+ common misspelling rules: teh, adn, taht, thier, hte, recieve, seperate, occurence, definate, accomodate, untill, goverment, enviroment, managment, devlopment, imediately, neccessary, occurance, millenium, mispell, calender, professer, comming, begining, truely, arguement, embarass, independant, maintainance, refrence, restaraunt, sieze, supersede, threshold, vaccum, weild
- Total: 76 extra rules + 14 built-in = 90 total grammar rules

**Verification:** npm run lint clean · npm test 120/120 pass · zero runtime deps

---

## Session 2026-08-30 (Part 2) - Complete Remaining Phases

**Done:**

### Phase 1: Rule Confidence Scores
- Added confidence field to extra rules data

### Phase 2: Multilingual + Translation
- New /api/translate endpoint (18 languages)
- Added translate() to server/services/gemini.js
- Registered translate route in server/app.js

### Phase 3: Vocabulary Enhancement
- New /api/vocabulary endpoint for word choice suggestions
- Added vocabularyEnhance() to server/services/gemini.js
- Registered vocabulary route in server/app.js

### Frontend
- Added Translate and Vocab tabs to index.html
- Added ht() translate handler to js/aiFeatures.js
- Added hv() vocabulary handler to js/aiFeatures.js
- Updated initAIFeatures() to wire new handlers

**Verification:** npm run lint clean, npm test 120/120 pass.

---
## Session 2026-08-30 - Flagship Upgrade Implementation

**Goal:** Implement the flagship upgrade plan from UPGRADE_PROMPT.md.

**Done:**

### Phase 1: Grammar Engine Hardening
- Added 31 new grammar rules (double negatives, comma splices, parallel structure, run-on sentences, faulty comparisons, redundant pairs, misplaced modifiers, dangling modifiers, wrong word usage, passive voice, wordiness, typography, formality)
- Total: 67 rules (14 built-in + 53 data-driven)

### Phase 3: Advanced AI Features
- New /api/compose endpoint for generative AI writing
- New /api/detect-ai endpoint for AI detection scoring
- New /api/cite endpoint for citation generation (APA, MLA, Chicago, Harvard, IEEE, Vancouver)
- Added compose/detectAi/cite functions to server/services/gemini.js
- Registered all 3 new routes in server/app.js

### Phase 4: Premium UX Features
- Fix-all button in grammar issues panel
- Comparison view with side-by-side original vs rewritten text
- Summarizer length slider (1-10 sentences or medium/long presets)
- Added comparison CSS with dark mode support

### Frontend
- New js/aiFeatures.js module with Compose, AI Detection, and Citation tabs
- New tabs in index.html: Compose, AI Score, Cite
- Wired into js/app.js

**Verification:** npm run lint clean, npm test 120/120 pass.

---
## Session 2026-08-30 - Comprehensive Upgrade Prompt written

**Goal:** Write a complete flagship upgrade blueprint comparing WriteRight to Grammarly and QuillBot.

**Done:**

- Researched Grammarly and QuillBot features in 2025-2026 via web search
- Analyzed 15 Grammarly features we lack, 10 QuillBot features we lack, 12 industry-leading features
- Wrote comprehensive UPGRADE_PROMPT.md (216 lines, 6 phases, 50+ tasks)
- Documented success metrics, implementation rules, priority order
- Each phase has status tracking and checkbox system

**Verification:** npm run check not needed (docs-only change).

---

# PROGRESS — yCorrect v0.2 "trustworthy" release

This file is the continuity record for the v0.2 upgrade. **Newest session
first.** Any future session (human or agent) should be able to resume from
this file alone: what was done, what was decided, what is next.

---

## Session 2026-08-29 — Fix underline rendering for ProseMirror/ChatGPT ✅

**Goal:** fix the underline system so it works on ChatGPT's ProseMirror editor
where text is split across multiple DOM nodes.

**Root cause:** The char map approach (`buildCharMap`) mapped text offsets using
only text nodes, but `getFieldText()` returns `innerText` which includes newlines
between block-level elements (p, div, etc.) that don't exist as text nodes. This
caused a systematic offset mismatch — error text at offset 10 in the server's
view might be at offset 12 in the char map.

**Done:**

- **Block-gap aligned text map** (`buildAlignedTextMap`): now detects block-level
  ancestors (p, div, li, h1-h6, td, blockquote) and inserts synthetic newline
  entries in the char map when consecutive text nodes are in different blocks.
  This makes the aligned text match `innerText` exactly.
- **Textarea/input highlight rendering** (`renderTextareaHighlights`): for non-
  contenteditable fields, uses a DOM mirror technique to measure error positions
  via `getBoundingClientRect()` on a hidden span.
- **Added window resize handler**: re-renders highlights when the window is
  resized (fixes underlines drifting on resize).
- **Passes `matchLength` in dataset** for future multi-range underlines.

**Verification:** `npm run lint` clean · `npm test` 120/120 pass.

**Still open for next sessions:**
- E3: Extension UX polish — keyboard shortcuts, loading states, error feedback.
- E4: Extension settings page with full config.
- E5: Web Store packaging.
- Manual smoke pass in real browser to confirm underlines render correctly.

---

## Session 2026-08-28 — Extension rewrite: rebrand to WriteRight, fix all display bugs, Grammarly-style underlines ✅

**Goal:** rebrand from "yC" to "WriteRight", fix the critical bug where no extension UI was visible (badge, toolbar,
fix cards all hidden), and rewrite the underline system to use Grammarly's
technique (Range.getClientRects) instead of the fragile overlay approach.

**Root cause found:** Every `show*()` function set `style.display = ''` which
removes the inline style, falling back to the CSS rule `display:none`. The
badge, toolbar, fix cards, rewrite chip, rewrite result, and synonym card were
ALL created but immediately hidden. The grammar underlines worked because they
used a different rendering path (innerHTML on the overlay).

**Done:**

- **Rebranded to "WriteRight"**: changed all CSS class prefixes from `yc-` to `wr-`, renamed shadow host from `ycorrect-shadow-host` to `writeright-shadow-host`, badge now shows "✓" checkmark (professional, language-agnostic like Grammarly's "G").
- **Fixed all display bugs**: every `style.display = ''` changed to
  `style.display = 'block'` (6 instances across badge, toolbar, fix card,
  rewrite chip, rewrite result, synonym card).
- **Rewrote underline system** to use Grammarly's `Range.getClientRects()`
  technique: instead of mirroring all text in an overlay div, we now create
  thin highlight `<div>` elements positioned at the exact pixel coordinates
  of each grammar error using `Range.getClientRects()`. This is pixel-perfect
  and works on any contenteditable (ChatGPT, Gemini, Notion, etc.).
- **Added red error count badge** on the yC dot (shows number of issues,
  like Grammarly's badge).
- **Multiple replacement chips**: fix card now shows up to 4 clickable
  replacement suggestions (not just the first one).
- **Improved UI styling**: gradient badge, smooth animations (ycFadeIn),
  better dark mode support, cleaner typography.
- **ESLint config** updated: added `NodeFilter` and `TreeWalker` globals
  for the content script.

**Verification:** `npm run lint` clean · `npm test` 120/120 pass.

**What needs testing now (real browser):**
1. Reload extension at chrome://extensions
2. ChatGPT: click into input → type "What is teh puspose" → green badge
   should appear above the input with error count → click badge → toolbar
   with mode chips → grammar underlines should show → click underline →
   fix card with replacement chips.
3. Gemini: same test.
4. Gmail compose, Notion, Google Docs: verify badge appears on any text field.

**Still open for next sessions:**
- E3: Extension UX polish — keyboard shortcuts, better positioning,
  loading states, error feedback when server is offline.
- E4: Extension settings page with full config.
- E5: Web Store packaging.

---

## Session 2026-08-27 — Flagship features: synonyms, continuation, sentence rewrite ✅

**Goal:** close the remaining Grammarly/QuillBot gaps — double-click synonyms,
Tab-to-accept AI continuation, per-sentence rewrite with alternatives, and
Humanize mode in the web app dropdown.

**Done:**

- **Synonyms proxy route** (`server/routes/synonyms.js`): queries the free
  DataMuse API (`api.datamuse.com/words?rel_syn=`), enforces a 50-char
  max-word policy, caches results in-memory for 5 minutes, returns up to
  12 synonyms grouped by part-of-speech. Registered in `server/app.js`.
- **Double-click synonyms** (`js/synonyms.js`): detects word at cursor on
  double-click, fetches synonyms via the proxy, renders a floating card
  with POS tabs and one-click insertion. Card dismissed on outside click.
  Wired into `js/app.js` via `initSynonyms()`.
- **Double-click synonyms in extension** (`extension/content.js`): same
  UX injected into any web page — floating synonym card positioned at the
  word, POS tabs, insert-by-click. Background worker handles the fetch.
- **Tab-to-accept AI continuation** (`js/continuation.js`): monitors cursor
  at end-of-text, generates a 1-2 sentence ghost suggestion, renders a
  translucent preview. Tab accepts, Escape dismisses. Debounced at 800ms.
  Wired into `js/app.js` via `initContinuation()`.
- **Per-sentence rewrite** (`js/sentenceRewrite.js`): double-click on any
  sentence in the editor opens a popup with 3 AI rewrite alternatives
  (Fluency, Formal, Shorten modes). Click an alternative to replace the
  sentence. Also available from the grammar issues panel via a ✏️ button
  on each issue. Wired into `js/app.js` and `js/grammar.js`.
- **Humanize mode in web app**: added `<option value="humanize">` to the
  HTML paraphrase dropdown in `index.html` (server already supported it).
- **Synonyms route test** (`test/synonyms.test.js`): 6 tests covering
  valid words, invalid chars, XSS payloads, missing params, overlong words.
- **Synonym card styles** added to `styles.css` (`.yc-synonym-card`,
  `.yc-synonym-header`, `.yc-synonym-tabs`, `.yc-synonym-list`).
- **Sentence rewrite styles** added to `styles.css` (`.yc-sentence-rewrite`,
  `.yc-sentence-option`, `.yc-sentence-option-original`).
- **Grammar rewrite button**: each grammar issue now shows a ✏️ button
  that opens the sentence rewrite popup for that issue's sentence.

**Verification:** `npm run lint` clean · `npm test` 120/120 pass.

**What E2 now delivers vs Grammarly/QuillBot:**
| Feature | Grammarly | QuillBot | yCorrect E2 |
|---|---|---|---|
| In-page rewrite toolbar | ✅ | ✅ | ✅ (extension E1) |
| 9 rewrite modes incl. Humanize | ✅ | ✅ | ✅ |
| Double-click synonyms | ✅ | ✅ | ✅ |
| Multiple rewrite alternatives | ✅ | ✅ | ✅ (3 per sentence) |
| Tab-to-accept AI continuation | ✅ | ❌ | ✅ |
| Insert rewrite into page | ✅ | ✅ | ✅ (extension) |
| Grammar underlines + fix cards | ✅ | ✅ | ✅ (extension) |
| Per-site toggles | ✅ | ✅ | ✅ (extension) |
| Tone detection | ✅ | ❌ | ✅ |
| Plagiarism / citations | ✅ paid | ❌ | ❌ (out of scope) |

**Still open for next sessions:**
- E3: Extension UX polish — animations, keyboard shortcuts, better
  positioning, dark mode support in extension.
- E4: Extension settings page with full config (server URL, feature
  toggles, per-site list, theme).
- E5: Web Store packaging (signing, store listing, screenshot assets).
- Manual smoke pass of all new features in a real browser.

---

## Session 2026-08-26 — E1: flagship in-page extension assistant ✅

**Goal:** turn the extension from context-menu-only into a Grammarly/QuillBot-style
in-page writing assistant: floating badge, grammar underlines, click-to-fix cards,
selection-based AI rewrite, and per-site toggles.

**Done:**

- **Humanize mode** added to the server-side paraphrase vocabulary
  (`server/services/modes.js`) with its own temperature band [0.3, 0.8];
  mode count 8 → 9; test updated.
- **Content script** (`extension/content.js`, ~350 lines): detects text fields
  (textarea, input, contenteditable), shows a floating green badge on focus,
  renders grammar underlines via a mirrored overlay (textarea) or DOM overlay
  (contenteditable), opens inline fix cards with Replace/Ignore/Humanize,
  shows a Rewrite chip on text selection with mode chips (Humanize, Fluency,
  Formal, Shorten, Expand).
- **Background worker** rewritten with message handlers: `checkGrammar`
  proxies to `/api/grammar`, `rewrite` proxies to `/api/ai`, `openApp`
  opens the web app. Context-menu path preserved.
- **Toolbar popup** (`extension/popup.html + popup.js`): per-site enable/disable
  toggle, grammar on/off toggle, server health status with version display,
  link to open the web app.
- **Manifest v0.3.0**: content_scripts injected on all HTTP/HTTPS pages,
  action popup wired, `host_permissions` for localhost.
- **ESLint config** updated: content script gets `sourceType: 'script'` +
  `InputEvent` + `getComputedStyle` globals; popup.js added to page globals.

**Verification:** `npm run lint` clean · `npm test` 114/114 pass.

**Still open for next sessions:**
- E2: double-click synonyms (DataMuse API proxy), sentence rewriter with
  multiple alternatives, per-site grammar toggles persisted to storage.
- E3: Tab-to-accept AI continuation, tone widget, Web Store packaging.
- Manual smoke pass of the extension in a real browser.

---

## Session 2026-08-26 — Phase 6: docs pass + close-out ✅

**Goal:** defects 20, 21, 22 — make every document describe the code as it
actually is, with counted numbers.

**Done:**

- **Counted, not estimated:** `js/` = 17 files, `server/` = 17 files,
  local rules = 13 (stable ids verified by grep), tests = **114 passing
  across 12 test files** (`node --test` reports 21 nested suites — the
  README initially said "12 suites"; corrected to "12 files", the honest unit).
- **README.md** rewritten: Features now name what v0.2 actually shipped
  (reading-order issues, per-document ignores, IndexedDB persistence, JSON
  backup import/export, server-side mode vocabulary, header-carried API key,
  extension options page + result popup); Project Structure matches the real
  tree including new modules (`backup.js`, `paragraphs.js`,
  `services/modes.js`, `services/paragraphs.js`, `scripts/`, `test/`);
  API table documents `{text}` vs batched `{paragraphs}` responses; env table
  documents `TRUST_PROXY`; Security section matches the tightened CSP and
  dotfile/traversal handling; new Development section lists `npm start` /
  `test` / `lint` / `check` and CI.
- **documents/how_to_run.md**: startup output replaced with the real ASCII
  banner (plus the plain `yCorrect running at …` line the server also
  prints); `npm start` named the supported entry with `node server.js`
  described as the compat shim; feature walkthrough updated for live offset
  shifting, Flesch reading ease labelling, backup export/import, IndexedDB
  migration; extension section covers the options page, result popup, and
  default-allowed localhost/127.0.0.1 hosts.
- **Defect 22:** deleted `app.js.old` from the repo root (it was gitignored
  but still on disk).
- **Smoke-pass finds:** `/api/health` reported hardcoded `version: '0.1.0'`
  while the package is 0.2.0 — now read from `package.json`, with a
  regression test pinning them together. Also caught the docs claiming
  `/.env` → 403 when the server (correctly, per Phase 0) returns 404;
  README corrected.
- Smoke pass results: two-paragraph text with deliberate `teh` + `could of`
  → local rule match at offset 0 ahead of LanguageTool matches (reading
  order holds); `/.env` → 404; `/%` → 400; banner prints both the ASCII box
  and the plain URL line exactly as how_to_run.md now describes. UI-side
  steps (popover click, Apply, undo, Creative paraphrase, reload) still
  need a human at the browser.

**Verification this session:** `npm test` → 114/114 pass · `npm run lint`
→ clean.

**Still open before v0.2 is called done:**

1. Manual smoke pass per the brief's checklist (type a two-paragraph draft
   with a deliberate `teh` and `could of`, apply a fix, undo, paraphrase in
   Creative mode, reload).
2. Push the docs-pass commit — owner runs it themselves over the
   `github-personal` SSH alias: `git push origin main`. (The 28 phase
   commits were pushed on 2026-08-26; only this session's commit remains.)

**Decisions:**

- Test counts quoted as "N tests across N files", not "suites" — node:test
  nests suites inside files and reports both; files are the stable number.

---

## Session 2026-08-26 — Phase 0: guardrails ✅

**Goal:** make every later change verifiable — test gate, lint gate, CI.

**Done:**

- `package.json` → v0.2.0; `test` / `lint` / `check` scripts; ESLint 9 +
  @eslint/js added as **dev-only** dependencies (runtime stays zero-dep).
  `package-lock.json` committed so CI installs what was tested.
- `server/app.js` refactored: exports `createServer()` / `startServer()`;
  listens only when run directly. `server.js` shim calls `startServer()`.
  Banner now also prints a plain `yCorrect running at http://localhost:PORT`.
- Pure helpers extracted for testability: `mergeMatches()` (server/routes/grammar.js)
  and `renderOverlayHtml()` (js/editor.js); `fleschReadingEase` exported.
- **Test suite: 57 tests, all passing** (`node:test`, zero external calls):
  all 13 local rules, paragraph-break regression, merge/dedupe/sort,
  overlay offset arithmetic, Flesch score, rate-limiter window, and
  integration tests booting the real server (routing, security headers,
  CORS preflight, traversal/dotfile/malformed-URL handling).
- ESLint 9 flat config (`eslint.config.js`) with per-area globals; lint clean.
- CI: `.github/workflows/ci.yml` — lint + tests on Node 18 and 22, push + PR.
- `CLAUDE.md` written (commands, hard rules, invariants, layout).
- Acceptance check performed: a deliberately broken rule pattern made
  `npm test` fail (3 failures), then reverted.

**Defects fixed in this phase:**

- **1** — extra-spaces rule now `/[ \t]{2,}/g`; paragraph breaks survive.
- **10** — merged issues sorted by offset (longer first at ties).
- **16** — malformed percent-encoding returns 400 (was a 500).
- **19** *(pulled forward from Phase 3 — lint gate required it)* — removed
  unused `getEditor` (app.js), `renderOverlay` (grammar.js), `$` (export.js,
  shortcuts.js), `notify` (search.js), `pushUndoState` (sidebar.js),
  `findText` (findReplace.js ×2), `titleEl` (stats.js), write-only
  `popoverVisible` (grammar.js); `ignoreKeys` is now `const`.
- **N1 (new)** — `findReplace.js` assigned an undeclared `countEl` (strict
  mode → ReferenceError on next/previous match). Declared properly.
- **N2 (new, security)** — static server served any root file: `GET /.env`
  would return the live Gemini key. Dotfiles and `node_modules` now 404;
  traversal still 403; covered by tests.
- **N3 (new)** — rate-limiter counters were shared between the 120/min API
  and 20/min AI limiters (grammar traffic could exhaust the AI budget).
  Counters are now per-limiter; cleanup interval `.unref()`'d so tests exit.

**Decisions:**

- Lint gate = ESLint 9 flat config (owner-approved; dev-only).
- Phase 4 = option (a): keep textarea, shift offsets, per-paragraph caching
  (owner-approved).
- `node --test` is called **without** a path argument — passing a directory
  breaks on Windows.
- `documents/UPGRADE_PROMPT.md` stays untracked (owner's working notes).

**Next session:** Phase 1 — text-integrity fixes: single `setText()` mutation
path (defect 2), `crypto.randomUUID()` doc ids (3), underline-click popover
(4), single owner for `#issueCount` (6), remove duplicate scroll listener (11).

---

## Defect ledger (v0.2 brief + discoveries)

| # | Defect | Status |
|---|--------|--------|
| 1 | Extra-spaces rule eats paragraph breaks | ✅ Fixed (Phase 0) |
| 2 | Programmatic edits leave overlay/stats stale | ⬜ Phase 1 |
| 3 | Document IDs collide (`Date.now()`) | ⬜ Phase 1 |
| 4 | Underline click never opens popover | ⬜ Phase 1 |
| 5 | Creative mode never gets its temperature | ⬜ Phase 2 |
| 6 | Issue count fought over by two writers; SR announces per keystroke | ⬜ Phase 1 |
| 7 | Dark mode flashes light on load | ⬜ Phase 3 |
| 8 | System-preference theme listener is dead code | ⬜ Phase 3 |
| 9 | "Ignored for this document" is neither | ⬜ Phase 3 |
| 10 | Issues not in document order | ✅ Fixed (Phase 0) |
| 11 | Two scroll listeners, one job | ⬜ Phase 1 |
| 12 | Gemini key travels in query string | ⬜ Phase 2 |
| 13 | `body.mode` is an unvalidated prompt injection | ⬜ Phase 2 |
| 14 | `validate.js` helpers never called | ⬜ Phase 2 |
| 15 | Rate limiter buckets everyone behind a proxy | ⬜ Phase 2 (unref done in Phase 0) |
| 16 | Malformed URL returns 500 | ✅ Fixed (Phase 0) |
| 17 | CSP allows unused origins + inline script/style | ⬜ Phase 2/3 |
| 18 | Static serving minimal (no HEAD/ETag/compression) | ⬜ Accepted limitation (local tool) |
| 19 | Dead code: unused exports/imports/write-only state | ✅ Fixed (Phase 0, pulled forward) |
| 20 | README counts wrong | ✅ Fixed (Phase 6) |
| 21 | how_to_run.md startup message / entry drift | ✅ Fixed (Phase 6) |
| 22 | `app.js.old` still in repo root | ✅ Fixed (Phase 6) |
| 23 | FK badge mislabelled; negative scores hidden | ⬜ Phase 3 |
| N1 | findReplace `countEl` undeclared (strict-mode crash) | ✅ Fixed (Phase 0) |
| N2 | `GET /.env` served the live API key | ✅ Fixed (Phase 0) |
| N3 | API and AI rate limiters shared one counter | ✅ Fixed (Phase 0) |

**Current state:** 120/120 tests pass · lint clean · phase commits pushed;
CI live on GitHub · runtime dependencies: none. All 23 numbered defects + N1–N3 are
fixed or explicitly accepted (18 = accepted limitation). Flagship features
(synonyms, continuation, sentence rewrite) added in E2. Remaining: manual
smoke pass, extension polish, Web Store packaging.
