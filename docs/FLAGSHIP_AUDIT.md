# FLAGSHIP AUDIT — yCorrect / WriteRight

You are auditing a real, already-partially-built product (self-hosted writing
assistant: Node.js server + LanguageTool + optional Gemini rewrite + Manifest V3
Chrome extension). The goal is not a rewrite. The goal is to close the gap between
what PROGRESS.md/README.md *claim* is working and what the code *actually* does,
then bring the UX and repo structure up to a standard a recruiter or a real user
would call "product," not "project."

## Ground rules

- Do not trust AUDIT.md, PROGRESS.md, README.md, or STORE.md claims at face value.
  Every claim gets checked against actual code or is marked UNVERIFIED.
- No estimated numbers. If you can't run/verify something (e.g. it needs a real
  browser), say so explicitly and add it to SMOKE_TEST.md instead of guessing.
- Prefer small, reversible commits over one giant refactor. Use `git mv` for any
  file moves so history is preserved.
- Stop and ask before any change that could break the Chrome Web Store submission
  described in STORE.md.

## Commit convention

One commit per fix, Conventional Commits format: `type(scope): message`.
Never bundle an unrelated fix into a restructure commit, and never bundle two P0
fixes into one commit — each row in `docs/GAP_REPORT.md` gets its own commit so the
history itself becomes evidence of what was actually verified and when (this is the
exact discipline PROGRESS.md has been missing). Use these types: `fix` (broken
behavior), `feat` (new capability, e.g. suggestion-review UX), `refactor`
(structure/code move, no behavior change), `docs` (README/PROGRESS/SMOKE_TEST),
`chore` (cleanup, renames), `perf` (latency/debounce work).

## Phase 0 — Read state

Read AUDIT.md, PROGRESS.md, SMOKE_TEST.md, CLAUDE.md, STORE.md, README.md, and the
actual manifest.json. Build a table: claim → where in code it's implemented →
verified or unverified. Output this as `docs/GAP_REPORT.md`.

## Phase 1 — Verify the specific known risks

1. **Underline / ProseMirror fix.** Find the actual code path that handles
   ChatGPT/ProseMirror editors. Confirm it runs, confirm it doesn't throw, and
   confirm (by reading the DOM manipulation logic, not just the commit message)
   that it does what PROGRESS.md claims. Mark VERIFIED-IN-CODE or
   NEEDS-BROWSER-CHECK.
2. **Content-script world isolation.** Confirm all content-script parts declared
   in manifest.json load in a single isolated world with no duplicate
   declarations across files. Flag anything that could cause
   `Identifier '…' has already been declared`.
3. **Suggestion-review UX.** Find the code path where a LanguageTool or Gemini
   suggestion gets applied to the page. Confirm the user sees a preview/diff and
   an explicit accept/reject/undo action, not a silent replace. If it's silent,
   this is a P0 fix — flag it as the single highest-priority UX gap vs.
   Grammarly/QuillBot.
4. **Branding.** Grep for "ycorrect" and "WriteRight" (case-insensitive) across
   manifest.json, package.json, README.md, STORE.md, popup/options HTML, and the
   domain config. List every place they disagree.

## Phase 2 — Gap report and prioritization

In `docs/GAP_REPORT.md`, bucket every finding:

- **P0 — breaks core trust** (claimed-but-broken fixes, console errors, silent
  auto-apply, branding mismatch that would fail Chrome Web Store review)
- **P1 — parity gap vs. competitors that's cheap to close** (visible diff UI,
  debounced calls + loading states, keyboard shortcuts, undo)
- **P2 — polish / defer** (anything that starts to look like chasing Grammarly's
  or QuillBot's full feature list — paraphrase modes, plagiarism/AI detection —
  is P2 unless you explicitly want to scope it in; don't let P2 block P0/P1)

## Phase 3 — Fix P0, then P1

Fix in order, one commit per fix (see Commit convention above). After each fix,
add a corresponding manual-verification row to SMOKE_TEST.md (this is the one
place estimated/unverified claims are not allowed — every row must be answered by
an actual human browser check, per its own stated philosophy). Suggested commits
for the risks already known going in — adjust scope/wording once you've confirmed
what's actually broken, but keep one commit per item:

| Fix | Commit message |
|---|---|
| Confirm/repair the ProseMirror underline handling | `fix(content-script): verify and repair ProseMirror underline handling` |
| Resolve any content-script world/isolation errors | `fix(content-script): eliminate console errors across isolated-world parts` |
| Replace silent auto-apply with preview + accept/reject/undo | `feat(extension): add suggestion preview with accept, reject, and undo` |
| Unify branding across manifest, README, store listing | `chore(branding): unify product name to [chosen name] everywhere` |
| Debounce LanguageTool calls, add loading state for Gemini | `perf(extension): debounce grammar calls and add rewrite loading state` |
| Add keyboard shortcuts for accept/reject/undo | `feat(extension): add keyboard shortcuts for suggestion review` |

## Phase 4 — Folder restructure

Current root has two problems an outside reader can't resolve on their own: two
candidate server entry points (`server.js` at root vs. a `server/` folder), and two
candidate web surfaces (root `index.html`/`styles.css`/`js/` vs. `extension/`) with
no way to tell which is live. Confirm which is actually in use before moving
anything, then migrate to this layout using `git mv` for every move (never
delete+recreate — history must survive):

```
ycorrect/
├── apps/
│   ├── extension/          # MV3 Chrome extension (content scripts, popup, options)
│   ├── server/              # Node.js API — LanguageTool proxy, Gemini calls, auth
│   └── web/                  # marketing/demo page (old root index.html/styles.css/js)
├── packages/
│   ├── shared-types/         # types shared between extension & server
│   └── prompts/              # Gemini prompt templates, versioned
├── docs/
│   ├── AUDIT.md
│   ├── PROGRESS.md
│   ├── STORE.md
│   ├── SMOKE_TEST.md
│   ├── FLAGSHIP_AUDIT.md
│   └── GAP_REPORT.md
├── tests/
│   ├── e2e/
│   └── unit/
├── scripts/
├── .github/
├── CLAUDE.md
├── README.md
├── LICENSE
└── package.json                # workspaces root (npm or pnpm workspaces)
```

Steps:
1. Switch to `npm workspaces` (or `pnpm workspaces` if already on pnpm) with
   `apps/*` and `packages/*` as workspace globs.
2. Move the confirmed-live server into `apps/server/`, the extension into
   `apps/extension/`, and the confirmed-live web surface into `apps/web/`. Delete
   the losing duplicate only after confirming with the user which one is dead code
   — do not guess.
3. Move `AUDIT.md`, `PROGRESS.md`, `STORE.md`, `SMOKE_TEST.md` into `docs/`.
   `README.md` and `CLAUDE.md` stay at root by convention.
4. Rename or remove `.freebuff` — confirm with the user what it was for before
   deleting; if unclear and unused by any import, remove it.
5. After each move: grep for the old path and fix every broken relative import,
   `manifest.json` content_script path, and build-config entry point before
   committing that move. Verify `dist/` still builds and the unpacked extension
   still loads (SMOKE_TEST.md §0.2) before moving to the next folder.

Commit per logical move, not one giant commit:
- `refactor(structure): set up npm/pnpm workspaces for apps and packages`
- `refactor(structure): move extension into apps/extension`
- `refactor(structure): move server into apps/server`
- `refactor(structure): move web surface into apps/web`
- `chore(cleanup): remove legacy prototype files after confirming apps/ is canonical`
- `docs(structure): consolidate status docs into docs/`
- `chore(cleanup): remove or rename .freebuff`

## Phase 5 — Positioning pass

Rewrite the top of README.md with one clear sentence: what this is, who it's for,
and the one differentiator that matters (self-hosted, free core, optional AI
rewrite you control). Do not lead with a feature list — lead with the promise.

Commit: `docs(readme): lead with self-hosted privacy-first positioning statement`

## Phase 6 — Close the loop

Update PROGRESS.md with dated, verified-only entries (no more "fixed, unconfirmed"
pattern — that's the exact failure mode this whole audit exists to end). Re-run
SMOKE_TEST.md in full. Report final pass/fail state honestly, including anything
still open.

Commit: `docs(progress): record verified fixes and final smoke-test pass for flagship audit`