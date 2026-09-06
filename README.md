# WriteRight

WriteRight is a self-hosted writing assistant for people who want a free grammar core and optional AI rewrites through their own server and API key.

Run a local web editor or use the Chrome extension to review suggestions in a page. The extension shows original and suggested text before acceptance, with rejection and guarded undo. These paths have automated regression coverage; the named-site browser matrix is still pending in [SMOKE_TEST.md](SMOKE_TEST.md).

**Where your writing goes:** self-hosting refers to the Node server. Grammar checks currently send text to the public LanguageTool API; optional AI features send text to Google Gemini; synonym lookups send the selected word to DataMuse. The repository has no analytics. This is not a fully offline product.

## Run locally

Requires Node.js 18+ as declared by the project; this audit was run on Node 24.14.0. Node 18/22 CI execution remains unverified in this audit.

```powershell
git clone git@github-personal:abhay-yemekar/ycorrect.git
cd ycorrect
npm ci
Copy-Item .env.example .env
# Set GEMINI_API_KEY in .env only if you want AI features.
npm start
```

Open http://localhost:3000. The root .env stays private and must never be committed. Grammar's built-in rules can still return results when LanguageTool is unavailable; AI requires a configured key.

## Chrome extension

1. Open Chrome's extensions page and enable Developer mode.
2. Load unpacked from apps/extension.
3. Focus a supported text field and type. Grammar suggestions appear after a pause.
4. Choose a grammar replacement, Fix All, or select text and request Rewrite. Review the original and suggestion, then Accept or Reject. Undo restores the reviewed edit only while the field still matches the accepted result.
5. Open Options to set a localhost server URL, manage disabled sites, or toggle grammar. Settings apply without a page reload.

Ctrl+Alt+Enter accepts the current review; Escape rejects/closes; Ctrl+Alt+Z undoes the last reviewed edit. Shortcuts apply in the review's editor or card and leave plain Ctrl+Z to the host. The context-menu path opens a separate original/suggestion window with Copy; it does not insert into the page.

Textarea, text input and contenteditable paths exist in code. ChatGPT, Gemini, Notion, Gmail and Google Docs support must be established by the human [browser checklist](SMOKE_TEST.md), not inferred from generic field detection. Rich-editor mutations depend on the host honoring its input transaction; if it refuses or transforms a batch, inspect the field and use native undo as directed by the error message.

## Web editor

The separate web app includes document persistence and backup, grammar issues, writing goals, rewrite variants, summaries, tone, export, find/replace and document search. Additional compose, translation, vocabulary and citation controls exist; AI quality and AI-detection accuracy are not validated by route-validation tests.

Web shortcuts: Ctrl+Enter checks grammar; Ctrl+Z / Ctrl+Shift+Z undo/redo; Ctrl+S saves; Ctrl+F finds text; Ctrl+Shift+F searches documents; Ctrl+Shift+D toggles the theme. Browser verification of these flows remains open.

## Development and architecture

Zero runtime dependencies: Node HTTP server, browser ES modules, MV3 classic content scripts. ESLint is development-only. npm workspaces use apps/* and packages/*.

```powershell
npm run check   # lint and node:test; no intended external test calls
npm run build   # dist/write-right-0.3.0.zip, manifest files at ZIP root
```

Current staged migration:

| Path | Actual role |
|---|---|
| apps/extension/ | Live MV3 source; popup, options, worker, seven ordered content scripts |
| server/app.js | Live API entry used by npm start |
| server.js | Compatibility shim for node server.js; not a duplicate server |
| index.html, styles.css, js/ | Live web editor served by the API server; not a discarded prototype |
| packages/shared-types/ | Type declarations for existing API responses; not runtime validation |
| packages/prompts/ | Reserved workspace; live prompts still reside in server/services |
| test/ | Unit, integration, ZIP and isolated-content-context regressions |
| scripts/ | Icon generation and ZIP packaging |
| docs/GAP_REPORT.md | Evidence, priorities, fixes and remaining gates |

The server, web, tests and status-document moves remain pending the extension-load gate. [CLAUDE.md](CLAUDE.md) describes implementation constraints. [PROGRESS.md](PROGRESS.md) records this audit separately from unverified historical narratives. [STORE.md](STORE.md) is a submission draft with a privacy correction awaiting owner approval; it is not ready to copy into a listing unchanged.

The product name is WriteRight. The GitHub repository/package identity ycorrect, YCORRECT_* environment variables and existing storage keys are retained for compatibility.

## API

| Endpoint | Method | Behavior |
|---|---|---|
| /api/health | GET | Version, uptime and AI configuration state |
| /api/grammar | POST | Whole text or paragraph batches; local rules plus public LanguageTool, with local fallback |
| /api/ai | POST | Rewrite using a validated server-side mode key |
| /api/summarize | POST | Summary in sentences, bullets or paragraph form |
| /api/tone | POST | AI tone/formality analysis |
| /api/compose | POST | AI writing from a prompt and genre |
| /api/detect-ai | POST | Model-generated score; accuracy unverified |
| /api/cite | POST | AI-generated citation; verify bibliographic details yourself |
| /api/translate | POST | Translation using a validated language key |
| /api/vocabulary | POST | AI vocabulary suggestions |
| /api/synonyms | GET | DataMuse lookup with word query parameter; no cache or route limiter currently |

Grammar uses the general limiter (120 requests/minute default); AI POST routes share a separate 20/minute budget. Synonyms is not wired to that limiter. These are configured limits, not measured throughput.

## Configuration and deployment

| Variable | Purpose |
|---|---|
| GEMINI_API_KEY | Optional server-side key for AI features |
| GEMINI_MODEL | Model ID; fallback gemini-2.5-flash. Confirm availability with Google before relying on a demo. Historical sunset-date claims are unverified. |
| PORT | Listen port; default 3000 |
| YCORRECT_CORS_ORIGIN | Allowed origins, comma-separated; defaults to * |
| YCORRECT_RATE_LIMIT | General API request budget; default 120/minute |
| TRUST_PROXY | Set to 1 only behind a trusted proxy to honor forwarded client IPs |

Supported use is a single trusted user running locally. The server binds to 0.0.0.0, has no authentication or TLS, and defaults to open CORS. Do not treat it as a public demo deployment. Public hosting needs authentication, HTTPS, quota controls and a shared limiter if multiple server instances are used.

The tests cover key headers, route validation, rate-limit separation, malformed URLs, traversal and dotfile blocking. Gemini receives the key in a request header. Static serving currently uses the repository root and permits non-dot source files; the planned web move will narrow the served directory.

## License

MIT. See [LICENSE](LICENSE).
