# yCorrect

A personal, open-source Grammarly-style writing assistant. yCorrect checks grammar with LanguageTool and provides AI rewriting tools through the Gemini Developer API.

## Features

- **Grammar & Spelling** — Real-time checking via LanguageTool + 14 built-in pattern rules, listed in reading order, clickable underlines, per-document "ignore forever"
- **AI Paraphrasing** — 9 modes (Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten, Humanize) with strength control — modes are a fixed vocabulary validated server-side
- **AI Summarization** — Key sentences, bullet points, or paragraph format
- **Tone Detection** — Live tone and formality analysis
- **Dark Mode** — System preference detection + manual toggle
- **Export** — Download as .txt, .md, or .html
- **Find & Replace** — In-editor search with match navigation
- **Document Search** — Search across all saved documents
- **Undo/Redo** — Full undo stack for AI actions and grammar fixes
- **Multi-Document** — Sidebar for managing multiple documents, persisted in IndexedDB with automatic migration from the older localStorage format
- **Backup** — One-click export/import of ALL documents as JSON; imports never overwrite existing documents
- **Writing Goals** — Audience, formality, and genre settings that guide AI rewrites
- **Readability Score** — Flesch reading ease score in the status bar
- **Keyboard Shortcuts** — Full keyboard navigation support
- **Accessibility** — ARIA live regions, focus management, skip links
- **Security** — Rate limiting (per-limiter budgets), strict CSP with no inline styles, CORS config, input validation, proxy-aware client IP handling
- **Chrome Extension** — Right-click "Improve with yCorrect" on any webpage → popup comparing original vs. suggestion with Copy; configurable server URL

## Quick Start

**Requirements:** Node.js 18+

```bash
git clone git@github.com:abhay-yemekar/ycorrect.git
cd ycorrect
cp .env.example .env
# Add GEMINI_API_KEY to .env for AI features
npm start
```

Open **http://localhost:3000**

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Grammar check |
| `Ctrl+Z` | Undo AI action |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Manual save |
| `Ctrl+F` | Find & Replace |
| `Ctrl+Shift+F` | Search across documents |
| `Ctrl+Shift+D` | Toggle dark mode |

## Development

Zero runtime dependencies — the server is raw `node:http` and the frontend is vanilla ES modules loaded directly by the browser.

```bash
npm start        # serve http://localhost:3000
npm test         # 127 tests across 13 files (built-in node:test, no external calls)
npm run lint     # ESLint 9 (dev-only dependency)
npm run check    # lint + tests together
```

CI runs lint + tests on Node 18 and 22 (`.github/workflows/ci.yml`). Architecture notes, invariants, and owner constraints live in [`CLAUDE.md`](CLAUDE.md); the v0.2 upgrade journal is [`PROGRESS.md`](PROGRESS.md).

## Project Structure

```
├── js/                    # Frontend ES modules (21 files)
│   ├── app.js            # Entry point — wires all modules
│   ├── editor.js         # Textarea, overlay, underlines, live offset shifting
│   ├── grammar.js        # Grammar checking, issues panel, popover
│   ├── ai.js             # Paraphrase, summarize, tone detection
│   ├── documents.js      # Document CRUD + IndexedDB persistence + backup merge
│   ├── backup.js         # Export/import all documents as JSON
│   ├── paragraphs.js     # Paragraph splitting/joining for batched checks
│   ├── sidebar.js        # Document list UI
│   ├── theme.js          # Dark mode — set before first paint, no flash
│   ├── shortcuts.js      # Undo/redo + keyboard shortcuts
│   ├── findReplace.js    # Ctrl+F find & replace
│   ├── search.js         # Ctrl+Shift+F cross-doc search
│   ├── export.js         # Download as TXT/MD/HTML
│   ├── accessibility.js  # ARIA, focus management, skip links
│   ├── stats.js          # Word count, Flesch reading ease
│   ├── tabs.js           # ARIA tab navigation
│   └── utils.js          # Shared helpers
│
├── server/                # Backend modules (24 files)
│   ├── app.js            # Entry point — middleware + routes
│   ├── static.js         # Static file server (dotfiles blocked, 400 on bad URLs)
│   ├── middleware/
│   │   ├── cors.js       # Configurable CORS
│   │   ├── rateLimit.js  # Per-IP fixed-window limiting (proxy-aware)
│   │   ├── security.js   # CSP with nonce'd theme bootstrap, other headers
│   │   ├── logger.js     # Request logging with timing
│   │   └── validate.js   # Input validation + sanitization (wired into routes)
│   ├── routes/
│   │   ├── grammar.js    # Grammar check: {text} or batched {paragraphs}
│   │   ├── ai.js         # AI rewrite — mode must be a known key
│   │   ├── summarize.js  # Summarize endpoint
│   │   ├── tone.js       # Tone detection endpoint
│   │   └── health.js     # Health check endpoint
│   └── services/
│       ├── gemini.js     # Gemini client — API key sent as a header
│       ├── languagetool.js # LanguageTool API client
│       ├── localRules.js # 14 built-in pattern rules with stable ids
│       ├── modes.js      # Server-side paraphrase mode map + temperature bands
│       └── paragraphs.js # Join/split paragraph batches around LanguageTool
│
├── extension/             # Chrome extension (Manifest V3) — options page, result popup
├── scripts/               # Zero-dependency dev tooling (icon generator)
├── test/                  # node:test suites (13 files, no external calls)
├── index.html             # Main UI (theme bootstrap inline in <head>)
```

## API Endpoints

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| `/api/health` | GET | — | Server status, version, and AI config |
| `/api/grammar` | POST | 120/min | `{text}` whole-document check, or `{paragraphs: [...]}` (max 200) for cache-aware clients; returns `{matches}` or `{paragraphMatches}` |
| `/api/ai` | POST | 20/min | AI rewrite via Gemini — `mode` must be one of the 9 known keys (Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten, Humanize) |
| `/api/summarize` | POST | 20/min | AI summarization via Gemini (sentences, bullets, or paragraph) |
| `/api/tone` | POST | 20/min | Tone/formality analysis via Gemini |
| `/api/compose` | POST | 20/min | Generative AI writing from a prompt + genre |
| `/api/detect-ai` | POST | 20/min | AI-generated-text detection scoring (0–100) |
| `/api/cite` | POST | 20/min | Citation generation (APA, MLA, Chicago, Harvard, IEEE, Vancouver) |
| `/api/translate` | POST | 20/min | AI translation to 18 languages |
| `/api/vocabulary` | POST | 20/min | Vocabulary enhancement suggestions (JSON) |
| `/api/synonyms` | GET | 120/min | Synonym/antonym/definition lookup via DataMuse proxy (query param `?word=`) |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | For AI features | — | Get from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use |
| `PORT` | No | `3000` | Server port |
| `YCORRECT_CORS_ORIGIN` | No | `*` | Comma-separated allowed origins |
| `YCORRECT_RATE_LIMIT` | No | `120` | Max requests per minute (general API budget) |
| `TRUST_PROXY` | No | unset | Set to `1` ONLY behind a trusted reverse proxy — enables honoring `x-forwarded-for` for rate-limit keys. Unset, the socket address is used exclusively and forwarded headers are ignored. |

## Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Right-click selected text → **Improve with yCorrect** → a popup shows the original next to the suggestion, with a Copy button
5. Right-click the toolbar icon → **Options** to change the server URL (default `http://localhost:3000`; `localhost`/`127.0.0.1` on any port work out of the box)

## Deployment

This is a **localhost-only personal tool** — the server binds to `0.0.0.0` but is
designed for a single trusted user on your own machine. There is no
authentication, no HTTPS, and the Gemini API key lives in the server's `.env`.

Before exposing it as a public demo, you need all of:

1. **Authentication** — anyone who can reach the server can use the AI features
   (and spend your Gemini quota). Add at least a shared API key.
2. **HTTPS** — the extension's `host_permissions` are scoped to
   `http://localhost/*` and `http://127.0.0.1/*`; a public deployment needs the
   manifest updated and a TLS-terminating reverse proxy.
3. **Cost controls** — use a **separate demo Gemini key** with a budget cap so a
   public demo can't run up your bill, plus per-user rate limits.
4. **Shared rate-limit store** — the rate limiter and synonym cache are
   in-memory and per-process; two instances would each allow the full budget.

Until then, the supported deployment is `npm start` on your own machine.

## Security

- API keys stay server-side (never exposed to the browser) and are sent to Gemini as a request header, never in the URL
- Rate limiting per IP with independent budgets (120 req/min general, 20 req/min AI); `x-forwarded-for` trusted only when `TRUST_PROXY=1`
- Strict CSP — no inline scripts except the hashed theme bootstrap, no inline styles, no third-party font/CDN origins
- Input validation on every route; paraphrase modes restricted to a server-side vocabulary
- Path traversal AND dotfile protection on static files (traversal → 403, `/.env` → 404)

## License

MIT
