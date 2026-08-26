# CLAUDE.md — working guide for AI assistants and humans

yCorrect is a zero-dependency, self-hosted, Grammarly-style writing assistant.
Node 18+ ES modules, raw `node:http` server, vanilla-JS frontend loaded
directly by the browser. No bundler, no framework, no build step.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the server on `http://localhost:3000` |
| `npm test` | Run the test suite (built-in `node:test`; makes no external calls) |
| `npm run lint` | ESLint 9 over every JS file |
| `npm run check` | Lint + tests — run this before committing anything |

## Hard rules (owner's constraints — never violate)

- **Zero runtime dependencies.** `dependencies` in package.json stays empty.
  DevDependencies are allowed (currently only ESLint + @eslint/js).
- **Never run `git push`.** Stage and commit if asked, then hand the exact push
  command to the owner (pushing needs an SSH passphrase only they have).
- The remote must stay on the **`github-personal`** SSH alias
  (`git@github-personal:abhay-yemekar/ycorrect.git`) — plain `github.com`
  resolves to a different account on this machine.
- Git identity is set with `--local` only, never `--global`. Email must be
  `99665612+abhay-yemekar@users.noreply.github.com` (GitHub blocks pushes
  that expose other addresses).
- **`.env` is real and holds a live Gemini API key.** Never read it into
  context, echo it, or commit it. `.env.example` is the only env file in git.
- No analytics, telemetry, or outbound calls the user did not ask for.
- Numbers in docs (file counts, rule counts, coverage) are **counted, not
  estimated**.

## Architecture invariants

- **Editor = textarea + mirrored overlay.** Issues are `{offset, length}`
  into `editor.value`. Every *programmatic* text change must go through
  `setText()` in `js/editor.js` — it shifts stored issue offsets, re-renders
  the overlay, and re-triggers the stats/save/check pipeline. Never assign
  `editor.value` directly; assigning `.value` fires no `input` event.
- `renderOverlayHtml(text, issues)` (js/editor.js) is **pure** and
  unit-tested in Node. Keep it DOM-free.
- `#issueCount` has exactly one writer: `renderIssuesPanel()` in
  `js/grammar.js`. Nothing else may write that element.
- Local grammar rules carry **stable ids**; per-document ignore lists are
  persisted with the document. Never key ignores on message text alone.
- Server: middleware chain in `server/app.js`; route handlers return data
  objects or `{ status, error }`; only `server/services/*` touch external
  APIs. `createServer()`/`startServer()` are exported so tests boot the real
  stack on an ephemeral port.
- The Gemini key travels in the `x-goog-api-key` **header**, never in a URL.
- Paraphrase modes live **server-side** (`server/services/modes.js`); clients
  send the mode *key*, never prompt text.
- Static serving never exposes dotfiles (`.env`, `.git/…`) or `node_modules`;
  malformed URLs get 400, traversal gets 403. Tests enforce all of this.
- Tests make **no external network calls** — LanguageTool/Gemini are never
  hit from the suite.

## Where things live

| Path | Role |
|---|---|
| `server/app.js` | Wiring + entry: middleware order, route table, static serving |
| `server/middleware/` | cors, rateLimit, security (headers/CSP), logger, validate |
| `server/routes/` | One file per endpoint; thin validation + delegation |
| `server/services/` | gemini, languagetool, localRules (pure), modes |
| `js/` | Frontend ES modules; `app.js` is the entry that wires the rest |
| `js/editor.js` | Textarea + overlay + `setText`/offset arithmetic |
| `js/grammar.js` | Check runner, issues panel, popover, ignore lists |
| `test/` | `node:test` unit + integration suites |
| `PROGRESS.md` | Session journal + defect ledger — **update it every session** |

## Testing notes

- `node --test` (no path argument) discovers `test/*.test.js` — passing a
  directory breaks on Windows.
- Each test file runs in its own process; the integration suite boots
  `createServer()` on port 0.
