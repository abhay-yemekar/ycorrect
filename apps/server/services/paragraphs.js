/**
 * Server-side paragraph batching.
 *
 * The client re-checks only dirty paragraphs. To stay within the public
 * LanguageTool API's per-IP rate limits, dirty paragraphs are JOINED into
 * one text (separated by blank lines), checked in a single pass, and the
 * resulting matches are split back per paragraph by offset.
 *
 * Pure — unit-tested.
 */

/**
 * @param {string[]} paragraphs
 * @returns {{ text: string, starts: number[], lengths: number[] }}
 */
export function joinParagraphs(paragraphs) {
  const starts = [];
  const lengths = [];
  let acc = 0;

  for (const p of paragraphs) {
    starts.push(acc);
    lengths.push(p.length);
    acc += p.length + 2; // '\n\n' separator, matching client splitting
  }

  return { text: paragraphs.join('\n\n'), starts, lengths };
}

/**
 * Split matches with combined-text offsets back into per-paragraph
 * buckets with paragraph-relative offsets. Matches that cross a
 * paragraph boundary are dropped (they only arise from rules whose
 * patterns span the separator, which are never meaningful).
 *
 * @param {object[]} matches — offsets into layout.text
 * @param {{ starts: number[], lengths: number[] }} layout
 * @returns {object[][]}
 */
export function splitMatches(matches, layout) {
  const { starts, lengths } = layout;
  const buckets = starts.map(() => []);

  for (const m of matches) {
    let idx = 0;
    for (let k = 0; k < starts.length; k++) {
      if (m.offset >= starts[k]) idx = k;
      else break;
    }

    const rel = { ...m, offset: m.offset - starts[idx] };
    if (rel.offset >= 0 && rel.offset + rel.length <= lengths[idx]) {
      buckets[idx].push(rel);
    }
  }

  return buckets;
}
