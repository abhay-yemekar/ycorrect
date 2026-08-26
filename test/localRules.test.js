/**
 * Tests for server/services/localRules.js — every built-in rule,
 * plus the paragraph-break regression (v0.2 defect 1).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLocal } from '../server/services/localRules.js';

/** Find the first match produced by a rule with the given message. */
function find(text, message) {
  return checkLocal(text).find(m => m.message === message);
}

describe('extra-spaces rule (defect 1)', () => {
  test('flags runs of horizontal spaces', () => {
    const m = find('hello  world', 'Remove extra spaces.');
    assert.ok(m, 'expected a match');
    assert.equal(m.offset, 5);
    assert.equal(m.length, 2);
    assert.deepEqual(m.replacements, [{ value: ' ' }]);
  });

  test('flags runs of tabs', () => {
    const m = find('a\t\tb', 'Remove extra spaces.');
    assert.ok(m);
    assert.equal(m.offset, 1);
    assert.equal(m.length, 2);
  });

  test('does NOT flag blank lines between paragraphs', () => {
    const matches = checkLocal('First paragraph.\n\nSecond paragraph.');
    assert.equal(
      matches.filter(m => m.message === 'Remove extra spaces.').length,
      0,
      'paragraph breaks must not be reported as extra spaces'
    );
  });

  test('does not flag single spaces or single newlines', () => {
    const matches = checkLocal('one two\nthree\nfour');
    assert.equal(matches.filter(m => m.message === 'Remove extra spaces.').length, 0);
  });
});

describe('all 13 rules fire correctly', () => {
  test('1 — doubled intensifier', () => {
    const m = find('It was very very good.', 'This phrase can be more concise.');
    assert.ok(m);
    assert.equal(m.offset, 7);
    assert.equal(m.length, 9);
    assert.equal(m.replacements[0].value, 'very');
  });

  test('2 — in order to', () => {
    const m = find('In order to succeed, plan.', '"In order to" can usually be simplified to "to".');
    assert.ok(m);
    assert.equal(m.offset, 0);
    assert.equal(m.length, 11);
    assert.equal(m.replacements[0].value, 'to');
  });

  test('4 — repeated word', () => {
    const m = find('the the cat', 'Avoid repeating the same word.');
    assert.ok(m);
    assert.equal(m.offset, 0);
    assert.equal(m.length, 7);
    assert.equal(m.replacements[0].value, 'the');
  });

  test('5 — could of', () => {
    const m = find('I could of known.', 'Use "could have" instead of "could of".');
    assert.ok(m);
    assert.equal(m.offset, 2);
    assert.equal(m.length, 8);
    assert.equal(m.replacements[0].value, 'could have');
  });

  test('6 — your + determiner', () => {
    const m = find('your the best', 'Did you mean "you\'re" (you are)?');
    assert.ok(m);
    assert.equal(m.replacements[0].value, "you're the");
  });

  test('7 — its + noun is flagged with no auto-fix', () => {
    const m = find('its own way', 'Check if "its" (possessive) or "it\'s" (it is) is correct here.');
    assert.ok(m);
    assert.deepEqual(m.replacements, []);
  });

  test('8 — common typos', () => {
    const m = find('teh cat', 'Possible typo.');
    assert.ok(m);
    assert.equal(m.length, 3);
    assert.equal(m.replacements[0].value, 'the');
    const m2 = find('i adn you', 'Possible typo.');
    assert.ok(m2);
    assert.equal(m2.replacements[0].value, 'and');
  });

  test('9 — standalone lowercase i', () => {
    const m = find('i am here', '"I" should always be capitalized.');
    assert.ok(m);
    assert.equal(m.offset, 0);
    assert.equal(m.length, 1);
    assert.equal(m.replacements[0].value, 'I');
  });

  test('9b — capital I is not flagged', () => {
    assert.equal(find('I am here', '"I" should always be capitalized.'), undefined);
  });

  test('10 — as well as', () => {
    const m = find('as well as possible', 'Consider using "and" for simpler writing.');
    assert.ok(m);
    assert.equal(m.replacements[0].value, 'and');
  });

  test('11 — due to the fact that', () => {
    const m = find('due to the fact that it rained', '"Due to the fact that" can be simplified to "because".');
    assert.ok(m);
    assert.equal(m.length, 20);
    assert.equal(m.replacements[0].value, 'because');
  });

  test('12 — at this point in time', () => {
    const m = find('at this point in time', 'Can be simplified to "now" or "currently".');
    assert.ok(m);
    assert.equal(m.length, 21);
    assert.equal(m.replacements[0].value, 'currently');
  });

  test('13 — in the event that', () => {
    const m = find('in the event that it rains', 'Can be simplified to "if".');
    assert.ok(m);
    assert.equal(m.length, 17);
    assert.equal(m.replacements[0].value, 'if');
  });
});

describe('rule metadata', () => {
  test('severity categories map to issue types', () => {
    const grammar = find('I could of known.', 'Use "could have" instead of "could of".');
    assert.equal(grammar.rule.issueType, 'grammar');
    assert.equal(grammar.rule.category.name, 'Grammar');

    const typo = find('teh cat', 'Possible typo.');
    assert.equal(typo.rule.issueType, 'misspelling');
    assert.equal(typo.rule.category.name, 'Misspelling');

    const spaces = find('hello  world', 'Remove extra spaces.');
    assert.equal(spaces.rule.issueType, 'style');
    assert.equal(spaces.rule.category.name, 'Typography');
  });

  test('global regexes are reset between calls', () => {
    const first = checkLocal('teh cat');
    const second = checkLocal('teh cat');
    assert.deepEqual(first, second);
  });

  test('clean text produces no matches', () => {
    assert.deepEqual(checkLocal('This is a clean sentence.'), []);
    assert.deepEqual(checkLocal(''), []);
  });
});
