# PROGRESS — yCorrect v0.2 "trustworthy" release

This file is the continuity record for the v0.2 upgrade. **Newest session
first.** Any future session (human or agent) should be able to resume from
this file alone: what was done, what was decided, what is next.

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
| 20 | README counts wrong | ⬜ Docs pass |
| 21 | how_to_run.md startup message / entry drift | ⬜ Docs pass |
| 22 | `app.js.old` still in repo root | ⬜ Docs pass |
| 23 | FK badge mislabelled; negative scores hidden | ⬜ Phase 3 |
| N1 | findReplace `countEl` undeclared (strict-mode crash) | ✅ Fixed (Phase 0) |
| N2 | `GET /.env` served the live API key | ✅ Fixed (Phase 0) |
| N3 | API and AI rate limiters shared one counter | ✅ Fixed (Phase 0) |

**Current state:** 57/57 tests pass · lint clean · CI configured (not yet
pushed) · runtime dependencies: none.
