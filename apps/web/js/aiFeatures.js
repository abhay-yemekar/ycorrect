/**
 * AI Features module -- Compose, AI Detection, Citation, Translation, Vocabulary.
 *
 * Each feature has its own handler function that calls the server API
 * and renders the result in the corresponding tab pane.
 */

import { esc, notify } from "./utils.js";
import { getEditor } from "./editor.js";

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem("ycorrectGoals") || "{}");
  } catch {
    return {};
  }
}

function variantHtml(text) {
  return "<div class=\"variant\"><div class=\"ai-text\">" + esc(text) + "</div><div class=\"ai-actions\"><button class=\"btn ghost small\" data-replace=\"" + esc(text) + "\">Replace</button><button class=\"btn ghost small\" data-copy=\"" + esc(text) + "\">Copy</button></div></div>";
}

async function handleCompose() {
  const prompt = document.querySelector("#composePrompt").value.trim();
  if (!prompt) return notify("Enter a prompt first.");
  const genre = document.querySelector("#composeGenre").value;
  const output = document.querySelector("#composeOut");
  output.innerHTML = "<div class=\"ai-loading\">Generating...</div>";
  try {
    const res = await fetch("/api/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, genre: genre, audience: loadGoals().audience || "General" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Compose failed");
    output.innerHTML = variantHtml(data.text);
  } catch (err) {
    output.innerHTML = "<div class=\"ai-error\">" + esc(err.message) + "</div>";
  }
}

async function handleDetectAi() {
  const text = getEditor().value.trim();
  if (!text) return notify("Write some text first.");
  const output = document.querySelector("#detectOut");
  output.innerHTML = "<div class=\"ai-loading\">Analyzing...</div>";
  try {
    const res = await fetch("/api/detect-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 10000) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Detection failed");
    const score = data.score || 0;
    const color = score > 70 ? "#ef4444" : score > 40 ? "#f59e0b" : "#10b981";
    output.innerHTML = "<div style=\"text-align:center;padding:20px\"><div style=\"font-size:48px;font-weight:700;color:" + color + "\">" + score + "%</div><div style=\"font-size:13px;margin-top:8px\">" + esc(data.reason || "") + "</div></div>";
  } catch (err) {
    output.innerHTML = "<div class=\"ai-error\">" + esc(err.message) + "</div>";
  }
}

async function handleCite() {
  const source = document.querySelector("#citeSource").value.trim();
  if (!source) return notify("Enter a URL or DOI first.");
  const style = document.querySelector("#citeStyle").value;
  const output = document.querySelector("#citeOut");
  output.innerHTML = "<div class=\"ai-loading\">Generating citation...</div>";
  try {
    const res = await fetch("/api/cite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source, style: style }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Citation failed");
    output.innerHTML = "<div class=\"variant\"><div class=\"ai-text\">" + esc(data.citation) + "</div><div class=\"ai-actions\"><button class=\"btn ghost small\" data-copy=\"" + esc(data.citation) + "\">Copy</button></div></div>";
  } catch (err) {
    output.innerHTML = "<div class=\"ai-error\">" + esc(err.message) + "</div>";
  }
}

async function handleTranslate() {
  const text = getEditor().value.trim();
  if (!text) return notify("Write some text first.");
  const lang = document.querySelector("#translateLang").value;
  const output = document.querySelector("#translateOut");
  output.innerHTML = "<div class=\"ai-loading\">Translating...</div>";
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, targetLanguage: lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translation failed");
    output.innerHTML = "<div class=\"variant\"><div class=\"ai-text\">" + esc(data.translation) + "</div><div class=\"ai-actions\"><button class=\"btn ghost small\" data-replace=\"" + esc(data.translation) + "\">Replace</button><button class=\"btn ghost small\" data-copy=\"" + esc(data.translation) + "\">Copy</button></div></div>";
  } catch (err) {
    output.innerHTML = "<div class=\"ai-error\">" + esc(err.message) + "</div>";
  }
}

async function handleVocabulary() {
  const text = getEditor().value.trim();
  if (!text) return notify("Write some text first.");
  const output = document.querySelector("#vocabOut");
  output.innerHTML = "<div class=\"ai-loading\">Analyzing...</div>";
  try {
    const res = await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 5000) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    let h = "<div style=\"padding:8px\">";
    if (data.suggestions && data.suggestions.length) {
      data.suggestions.forEach(function(s) {
        h += "<div style=\"margin-bottom:8px;padding:8px;border-radius:6px;border:1px solid #e2e8f0\"><b>" + esc(s.word) + "</b> -> <b style=\"color:#10b981\">" + esc(s.replacement) + "</b><div style=\"font-size:12px;color:#718096\">" + esc(s.reason) + "</div></div>";
      });
    } else {
      h += "No suggestions.";
    }
    h += "</div>";
    output.innerHTML = h;
  } catch (err) {
    output.innerHTML = "<div class=\"ai-error\">" + esc(err.message) + "</div>";
  }
}

export function initAIFeatures() {
  const a = document.querySelector("#composeBtn");
  if (a) a.addEventListener("click", handleCompose);
  const b = document.querySelector("#detectBtn");
  if (b) b.addEventListener("click", handleDetectAi);
  const ci = document.querySelector("#citeBtn");
  if (ci) ci.addEventListener("click", handleCite);
  const tr = document.querySelector("#translateBtn");
  if (tr) tr.addEventListener("click", handleTranslate);
  const vb = document.querySelector("#vocabBtn");
  if (vb) vb.addEventListener("click", handleVocabulary);
}
