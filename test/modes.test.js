/**
 * Tests for server/services/modes.js — the server-side paraphrase
 * vocabulary (defect 13) and its temperature bands (defect 5).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PARA_MODES, MODE_KEYS, temperatureFor } from '../server/services/modes.js';

describe('PARA_MODES', () => {
  test('exposes exactly the nine documented modes', () => {
    assert.deepEqual([...MODE_KEYS].sort(), [
      'Academic', 'Creative', 'Expand', 'Fluency', 'Formal', 'Humanize', 'Shorten', 'Simple', 'Standard',
    ]);
  });

  test('every mode has non-empty prompt text and a temperature band', () => {
    for (const key of MODE_KEYS) {
      const mode = PARA_MODES[key];
      assert.equal(typeof mode.prompt, 'string');
      assert.ok(mode.prompt.length > 10, `${key} prompt looks real`);
      assert.equal(mode.temp.length, 2);
      assert.ok(mode.temp[0] < mode.temp[1], `${key} band is ordered`);
    }
  });
});

describe('temperatureFor (defect 5: Creative must get its hot band)', () => {
  test('Creative spans the hot band', () => {
    assert.equal(temperatureFor('Creative', 0), 0.5);
    assert.equal(temperatureFor('Creative', 1), 0.95);
  });

  test('Standard spans the conservative band', () => {
    assert.equal(temperatureFor('Standard', 0), 0.15);
    assert.equal(temperatureFor('Standard', 1), 0.65);
  });

  test('Creative is always hotter than Standard at equal strength', () => {
    for (const strength of [0, 0.25, 0.5, 0.75, 1]) {
      assert.ok(
        temperatureFor('Creative', strength) > temperatureFor('Standard', strength),
        `strength ${strength}`
      );
    }
  });

  test('variant 2 runs hotter and is capped at 1', () => {
    assert.equal(temperatureFor('Standard', 1, 2), 0.8);
    assert.ok(temperatureFor('Creative', 1, 2) <= 1);
  });

  test('strength outside 0–1 is clamped', () => {
    assert.equal(temperatureFor('Standard', 42), 0.65);
    assert.equal(temperatureFor('Standard', -7), 0.15);
  });
});
