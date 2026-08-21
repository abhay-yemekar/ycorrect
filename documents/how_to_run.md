# How to Run yCorrect

This guide walks through running the yCorrect writing assistant on your local machine.

## 1. Prerequisites

- **Node.js 18 or newer** — verify with:

  ```bash
  node --version
  ```

  If Node.js is not installed, download it from <https://nodejs.org>.
- A modern web browser (Chrome, Edge, Firefox, or Safari).

## 2. Get the project files

Open a terminal in the project root directory, e.g.:

```bash
cd C:\Playground\ycorrect
```

## 3. Configure the environment

1. Copy the environment template to create your `.env` file:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Gemini API key for the AI rewriting features:

   ```dotenv
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3000
   ```

   Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

   **Note:** Grammar checking works without a key. AI tools show an error message until a key is added. Never commit `.env` — it is already listed in `.gitignore`.

## 4. Start the server

From the project root, run:

```bash
npm start
```

or directly:

```bash
node server.js
```

You should see:

```
yCorrect running at http://localhost:3000
```

## 5. Open the app

Open <http://localhost:3000> in your browser. You can now:

- Write or paste text in the editor — grammar is checked automatically as you type (850ms after you pause), or click **Check writing** / press `Ctrl+Enter`
- Issues appear both in the side panel and as **underlines in your text**: red = correctness, blue = clarity, yellow = style. Click an underline (or a panel item) to open a popover with the fix, explanation, Apply and Ignore
- See live stats: word/character count, reading time, Flesch readability score, and detected **tone** (top bar badge — click to refresh)
- **Paraphrase** tab: 8 modes (Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten) plus a strength slider — works on selected text or the whole document, with two variants to choose from
- **Summarize** tab: key sentences, bullets, or paragraph — short/medium/long
- **Goals** tab: audience, formality and genre settings that guide every AI rewrite, paraphrase and summary
- Manage multiple documents from the sidebar (new, switch, rename, delete) — all saved locally in your browser

## 6. (Optional) Load the browser extension

1. Open your browser's extension management page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder inside the project root.
4. With the server running, right-click any selected text on a page and choose **Improve with yCorrect**. The suggestion appears as a browser notification.

## 7. Stopping the server

Press `Ctrl+C` in the terminal where the server is running.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Node.js 16 or lower detected` | Install Node.js 18+ and rerun `npm start`. |
| `Address already in use` | Another process is on port 3000. Change `PORT` in `.env` or stop the other process. |
| Grammar check shows "unavailable" | The server must be running at localhost:3000, and internet access is required for the LanguageTool API. |
| AI tools show a setup message | Add `GEMINI_API_KEY` to `.env` and restart the server. |
| Extension can't reach the server | Make sure the server is running and the `http://localhost:3000/*` host permission is active (reload the extension). |