/**
 * Tests for js/editor.js → shiftIssues: how stored issue offsets track
 * text edits (defect 2). Pure function — no DOM.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftIssues } from '../js/editor.js';

const iss = (offset, length, label = 'x') => ({ offset, length, label });

describe('shiftIssues', () => {
  test('issue before an insertion is unchanged', () => {
    const issues = [iss(0, 3, 'before')];
    const out = shiftIssues(issues, 'aaa bbb', 'aaaXX bbb');
    assert.deepEqual(out, [iss(0, 3, 'before')]);
  });

  test('issue after an insertion shifts by the delta', () => {
    const out = shiftIssues([iss(4, 3, 'after')], 'aaa bbb', 'aaaXX bbb');
    assert.deepEqual(out, [iss(6, 3, 'after')]);
  });

  test('issue after a deletion shifts back', () => {
    const out = shiftIssues([iss(6, 3, 'after')], 'aaaXX bbb', 'aaa bbb');
    assert.deepEqual(out, [iss(4, 3, 'after')]);
  });

  test('issue containing the edit is dropped', () => {
    // 'bbb' at 4..7; edit replaces chars 5..6
    const out = shiftIssues([iss(4, 3, 'hit')], 'aaa bbb', 'aaa bZb');
    assert.deepEqual(out, []);
  });

  test('issue partially overlapping the edit start is dropped', () => {
    // 'bbb' at 4..7; edit deletes chars 3..5 (space + first b)
    const out = shiftIssues([iss(4, 3, 'hit')], 'aaa bbb', 'aaabb');
    assert.deepEqual(out, []);
  });

  test('issue entirely before a deletion is unchanged', () => {
    const out = shiftIssues([iss(0, 3, 'keep')], 'aaa bbb', 'aaabbb');
    assert.deepEqual(out, [iss(0, 3, 'keep')]);
  });

  test('multiple issues: before kept, intersecting dropped, after shifted', () => {
    const issues = [iss(0, 3, 'a'), iss(6, 4, 'b'), iss(14, 3, 'c')];
    // 'one two three four' → replace 'three' (6..11) with '3'
    const out = shiftIssues(issues, 'one two three four', 'one two 3 four');
    assert.deepEqual(out, [iss(0, 3, 'a'), iss(10, 3, 'c')]);
  });

  test('edit at the very start shifts everything after', () => {
    const out = shiftIssues([iss(2, 3, 'x')], 'abcdef', 'XXabcdef');
    assert.deepEqual(out, [iss(4, 3, 'x')]);
  });

  test('no change in text keeps all issues', () => {
    const issues = [iss(0, 3), iss(5, 2)];
    assert.deepEqual(shiftIssues(issues, 'same', 'same'), issues);
  });

  test('empty next text drops everything', () => {
    assert.deepEqual(shiftIssues([iss(0, 3)], 'abc', ''), []);
  });

  test('issue objects are not mutated', () => {
    const original = iss(6, 3, 'after');
    shiftIssues([original], 'aaa bbb', 'aaaXX bbb');
    assert.equal(original.offset, 6);
  });
});
