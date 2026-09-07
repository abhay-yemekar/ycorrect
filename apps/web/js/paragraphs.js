/**
 * Paragraph helpers for per-paragraph grammar caching.
 *
 * Pure and DOM-free — unit-tested in Node. Paragraphs are separated by
 * blank lines (\n\n+); single newlines stay inside a paragraph so
 * LanguageTool keeps its sentence context.
 */

/**
 * Split text into paragraphs with their full-text offsets.
 * @param {string} text
 * @returns {{ text: string, offset: number }[]}
 */
export function splitParagraphs(text) {
  const out = [];
  let pos = 0;

  while (pos < text.length) {
    const rest = text.slice(pos);
    const sep = /\n{2,}/.exec(rest);
    if (!sep) {
      out.push({ text: rest, offset: pos });
      break;
    }
    out.push({ text: rest.slice(0, sep.index), offset: pos });
    pos += sep.index + sep[0].length;
  }

  return out;
}

/**
 * Combine per-paragraph matches (paragraph-relative offsets) into
 * full-text offsets. Null entries (paragraph changed mid-check) are
 * skipped — they will be covered by the next scheduled check.
 *
 * @param {{ text: string, offset: number }[]} paragraphs
 * @param {(object[]|null)[]} matchesPerParagraph
 * @returns {object[]}
 */
export function stitchMatches(paragraphs, matchesPerParagraph) {
  const out = [];
  paragraphs.forEach((p, i) => {
    for (const m of matchesPerParagraph[i] || []) {
      out.push({ ...m, offset: m.offset + p.offset });
    }
  });
  return out;
}

/**
 * Sort matches in reading order (offset, then longer first) — the same
 * ordering the server guarantees for whole-text checks (defect 10).
 */
export function sortMatches(matches) {
  return matches.sort((a, b) => a.offset - b.offset || b.length - a.length);
}
