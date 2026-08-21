# yCorrect

A personal, open-source Grammarly-style writing assistant. yCorrect checks grammar with LanguageTool and provides AI rewriting tools through the Gemini Developer API.

## Features

- **Grammar & Spelling** — Real-time checking via LanguageTool + 12 built-in pattern rules
- **AI Paraphrasing** — 8 modes (Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten) with strength control
- **AI Summarization** — Key sentences, bullet points, or paragraph format
- **Tone Detection** — Live tone and formality analysis
- **Dark Mode** — System preference detection + manual toggle
- **Export** — Download as .txt, .md, or .html
- **Find & Replace** — In-editor search with match navigation
- **Document Search** — Search across all saved documents
- **Undo/Redo** — Full undo stack for AI actions and grammar fixes
- **Multi-Document** — Sidebar for managing multiple documents (all saved locally)
- **Writing Goals** — Audience, formality, and genre settings that guide AI rewrites
- **Readability Score** — Flesch reading ease score in the status bar
- **Keyboard Shortcuts** — Full keyboard navigation support
- **Accessibility** — ARIA live regions, focus management, skip links
- **Security** — Rate limiting, CSP headers, CORS config, input validation
- **Chrome Extension** — Right-click "Improve with yCorrect" on any webpage

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

## Project Structure

```
├── js/                    # Frontend ES modules (14 files)
│   ├── app.js            # Entry point — wires all modules
│   ├── editor.js         # Textarea, overlay, underlines
│   ├── grammar.js        # Grammar checking, issues panel, popover
│   ├── ai.js             # Paraphrase, summarize, tone detection
│   ├── documents.js      # Multi-document CRUD + localStorage
│   ├── sidebar.js        # Document list UI
│   ├── theme.js          # Dark mode with system preference
│   ├── shortcuts.js      # Undo/redo + keyboard shortcuts
│   ├── findReplace.js    # Ctrl+F find & replace
│   ├── search.js         # Ctrl+Shift+F cross-doc search
│   ├── export.js         # Download as TXT/MD/HTML
│   ├── accessibility.js  # ARIA, focus management, skip links
│   ├── loading.js        # Spinners, skeleton UI
│   ├── stats.js          # Word count, readability score
│   ├── tabs.js           # Tab navigation
│   └── utils.js          # Shared helpers
│
├── server/                # Backend modules (14 files)
│   ├── app.js            # Entry point — middleware + routes
│   ├── static.js         # Static file server
│   ├── middleware/
│   │   ├── cors.js       # Configurable CORS
│   │   ├── rateLimit.js  # Per-IP rate limiting
│   │   ├── security.js   # CSP, X-Frame-Options, etc.
│   │   ├── logger.js     # Request logging with timing
│   │   └── validate.js   # Input validation + sanitization
│   ├── routes/
│   │   ├── grammar.js    # Grammar check endpoint
│   │   ├── ai.js         # AI rewrite endpoint
│   │   ├── summarize.js  # Summarize endpoint
│   │   ├── tone.js       # Tone detection endpoint
│   │   └── health.js     # Health check endpoint
│   └── services/
│       ├── gemini.js     # Gemini API client
│       ├── languagetool.js # LanguageTool API client
│       └── localRules.js # 12 pattern-based grammar rules
│
├── extension/             # Chrome extension (Manifest V3)
├── index.html             # Main UI
├── styles.css             # Responsive + dark mode styles
└── package.json
```

## API Endpoints

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| `/api/health` | GET | — | Server status and AI config |
| `/api/grammar` | POST | 120/min | Grammar check via LanguageTool + local rules |
| `/api/ai` | POST | 20/min | AI rewrite/paraphrase via Gemini |
| `/api/summarize` | POST | 20/min | AI summarization via Gemini |
| `/api/tone` | POST | 20/min | Tone/formality analysis via Gemini |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | For AI features | — | Get from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use |
| `PORT` | No | `3000` | Server port |
| `YCORRECT_CORS_ORIGIN` | No | `*` | Comma-separated allowed origins |
| `YCORRECT_RATE_LIMIT` | No | `120` | Max requests per minute |

## Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder
4. Right-click selected text → **Improve with yCorrect**

## Security

- API keys stay server-side (never exposed to the browser)
- Rate limiting per IP (120 req/min general, 20 req/min for AI)
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Input validation and text sanitization
- Path traversal protection on static files

## License

MIT
