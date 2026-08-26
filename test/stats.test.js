/**
 * Tests for the readability stat (js/stats.js → fleschReadingEase).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fleschReadingEase } from '../js/stats.js';

describe('fleschReadingEase', () => {
  test('empty text returns the em-dash placeholder', () => {
    assert.equal(fleschReadingEase(''), '—');
    assert.equal(fleschReadingEase('   '), '—');
  });

  test('simple short sentences score high (easy to read)', () => {
    const score = fleschReadingEase('The cat sat on the mat. It was warm.');
    assert.equal(typeof score, 'number');
    assert.ok(score >= 80, `expected >= 80, got ${score}`);
  });

  test('dense polysyllabic text scores lower than simple text', () => {
    const easy = fleschReadingEase('The cat sat on the mat. It was warm.');
    const dense = fleschReadingEase(
      'Incomprehensible anthropomorphized terminological inflexibilities constitutionalized.'
    );
    assert.ok(easy > dense, `expected easy (${easy}) > dense (${dense})`);
  });

  test('a single sentence without terminal punctuation still scores', () => {
    const score = fleschReadingEase('no punctuation here at all');
    assert.equal(typeof score, 'number');
    assert.ok(Number.isFinite(score));
  });
});
