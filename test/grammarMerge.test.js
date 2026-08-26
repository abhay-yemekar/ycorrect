/**
 * Tests for the grammar merge/dedupe/sort step (server/routes/grammar.js).
 * Defect 10: merged issues must come back in reading order.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMatches } from '../server/routes/grammar.js';

const match = (offset, length, message) => ({ offset, length, message, replacements: [], rule: {} });

describe('mergeMatches', () => {
  test('sorts merged matches by offset (defect 10: reading order)', () => {
    const local = [match(20, 3, 'local-late')];
    const remote = [match(5, 4, 'remote-early')];
    const merged = mergeMatches(local, remote);
    assert.deepEqual(merged.map(m => m.message), ['remote-early', 'local-late']);
  });

  test('at equal offsets, the longer match comes first', () => {
    const merged = mergeMatches(
      [match(5, 3, 'short')],
      [match(5, 10, 'long')]
    );
    assert.deepEqual(merged.map(m => m.message), ['long', 'short']);
  });

  test('dedupes identical offset+length+message across sources', () => {
    const merged = mergeMatches(
      [match(5, 3, 'same')],
      [match(5, 3, 'same')]
    );
    assert.equal(merged.length, 1);
  });

  test('keeps matches with the same range but different messages', () => {
    const merged = mergeMatches(
      [match(5, 3, 'alpha')],
      [match(5, 3, 'beta')]
    );
    assert.equal(merged.length, 2);
  });

  test('returns empty for empty inputs', () => {
    assert.deepEqual(mergeMatches([], []), []);
  });
});
