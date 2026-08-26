/**
 * Tests for js/paragraphs.js — the client-side half of per-paragraph
 * grammar caching (Phase 4). Pure functions, no DOM.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { splitParagraphs, stitchMatches, sortMatches } from '../js/paragraphs.js';

describe('splitParagraphs', () => {
  test('splits on blank lines and reports full-text offsets', () => {
    const text = 'first para\n\nsecond para\n\nthird';
    assert.deepEqual(splitParagraphs(text), [
      { text: 'first para', offset: 0 },
      { text: 'second para', offset: 12 },
      { text: 'third', offset: 25 },
    ]);
  });

  test('single newlines stay inside one paragraph', () => {
    const paras = splitParagraphs('line one\nline two');
    assert.equal(paras.length, 1);
    assert.equal(paras[0].text, 'line one\nline two');
  });

  test('runs of 3+ newlines are one separator', () => {
    const paras = splitParagraphs('a\n\n\nb');
    assert.deepEqual(paras.map(p => p.text), ['a', 'b']);
    assert.equal(paras[1].offset, 4);
  });

  test('leading blank line yields an empty first paragraph', () => {
    const paras = splitParagraphs('\n\nb');
    assert.deepEqual(paras, [
      { text: '', offset: 0 },
      { text: 'b', offset: 2 },
    ]);
  });

  test('empty text yields no paragraphs', () => {
    assert.deepEqual(splitParagraphs(''), []);
  });

  test('offsets always point at the right characters', () => {
    const text = 'alpha\n\nbeta gamma\n\ndelta';
    for (const p of splitParagraphs(text)) {
      assert.ok(text.startsWith(p.text, p.offset), `offset ${p.offset} for "${p.text}"`);
    }
  });
});

describe('stitchMatches', () => {
  test('shifts paragraph-relative offsets into full-text offsets', () => {
    const paragraphs = [
      { text: 'teh cat', offset: 0 },
      { text: 'ok paragraph', offset: 9 },
      { text: 'i am here', offset: 23 },
    ];
    const stitched = stitchMatches(paragraphs, [
      [{ offset: 0, length: 3, message: 'typo' }],
      [],
      [{ offset: 0, length: 1, message: 'capital i' }],
    ]);
    assert.deepEqual(stitched, [
      { offset: 0, length: 3, message: 'typo' },
      { offset: 23, length: 1, message: 'capital i' },
    ]);
  });

  test('null entries (paragraph changed mid-check) are skipped', () => {
    const stitched = stitchMatches(
      [{ text: 'a', offset: 0 }, { text: 'b', offset: 3 }],
      [null, [{ offset: 0, length: 1 }]]
    );
    assert.deepEqual(stitched, [{ offset: 3, length: 1 }]);
  });
});

describe('sortMatches', () => {
  test('orders by offset, longer first at ties (defect 10)', () => {
    const sorted = sortMatches([
      { offset: 5, length: 3 },
      { offset: 0, length: 2 },
      { offset: 5, length: 10 },
    ]);
    assert.deepEqual(sorted.map(m => m.length), [2, 10, 3]);
  });
});
