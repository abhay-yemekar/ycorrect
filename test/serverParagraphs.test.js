/**
 * Tests for server/services/paragraphs.js — the server half of
 * per-paragraph batching (Phase 4): join dirty paragraphs into one
 * LanguageTool request, then split matches back by offset.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { joinParagraphs, splitMatches } from '../server/services/paragraphs.js';
import { checkLocal } from '../server/services/localRules.js';

describe('joinParagraphs', () => {
  test('computes starts with \\n\\n separators', () => {
    const layout = joinParagraphs(['abc', 'de', 'f']);
    assert.equal(layout.text, 'abc\n\nde\n\nf');
    assert.deepEqual(layout.starts, [0, 5, 9]);
    assert.deepEqual(layout.lengths, [3, 2, 1]);
  });

  test('empty paragraph list yields empty text', () => {
    const layout = joinParagraphs([]);
    assert.equal(layout.text, '');
    assert.deepEqual(layout.starts, []);
  });
});

describe('splitMatches round-trip', () => {
  test('batched check matches direct per-paragraph checks', () => {
    const paragraphs = [
      'I could of known teh answer.',
      'This paragraph is clean, more or less.',
      'in order to succeed  work hard.',
      '',
    ];

    // Direct: check each paragraph on its own
    const direct = paragraphs.map(p => checkLocal(p));

    // Batched: join, check once, split back
    const layout = joinParagraphs(paragraphs);
    const combined = checkLocal(layout.text);
    const batched = splitMatches(combined, layout);

    assert.deepEqual(batched, direct);
  });

  test('drops matches that cross a paragraph boundary', () => {
    // The repeated-word rule's \s+ can span a blank-line separator
    const layout = joinParagraphs(['two', 'two']);
    const crossed = [{ offset: 0, length: 8, message: 'Avoid repeating the same word.', replacements: [], rule: {} }];
    const buckets = splitMatches(crossed, layout);
    assert.deepEqual(buckets, [[], []]);
  });

  test('assigns each match to the paragraph containing its offset', () => {
    const layout = joinParagraphs(['teh cat', 'adn dog']);
    const combined = [
      { offset: 0, length: 3, message: 'typo-teh', replacements: [], rule: {} },
      { offset: 9, length: 3, message: 'typo-adn', replacements: [], rule: {} },
    ];
    const buckets = splitMatches(combined, layout);
    assert.equal(buckets[0][0].offset, 0);
    assert.equal(buckets[1][0].offset, 0); // 9 - starts[1](9) = 0
    assert.equal(buckets[1][0].message, 'typo-adn');
  });

  test('empty input produces empty buckets', () => {
    assert.deepEqual(splitMatches([], joinParagraphs([])), []);
  });
});
