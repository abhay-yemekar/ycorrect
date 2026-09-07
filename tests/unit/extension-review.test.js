import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './helpers/content-harness.js';

test('review previews without mutation, targets captured field, and undoes accepted edit', async () => {
  const h = await contentHarness();
  h.context.first = new h.Field('teh cat');
  h.context.second = new h.Field('other field');
  h.run("activeField = first; showSuggestionReview(captureReviewTarget(0, 3), 'the', 'Grammar')");
  assert.equal(h.context.first.value, 'teh cat');
  assert.match(h.run('reviewCard.innerHTML'), /Original[\s\S]*Suggestion[\s\S]*Accept[\s\S]*Reject/);
  h.run('activeField = second; acceptSuggestionReview()');
  assert.equal(h.context.first.value, 'the cat');
  assert.equal(h.context.second.value, 'other field');
  assert.equal(h.run('undoSuggestionReview()'), true);
  assert.equal(h.context.first.value, 'teh cat');
});

test('reject and stale acceptance cannot mutate text; undo refuses later edits', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('teh cat');
  h.run("activeField = field; showSuggestionReview(captureReviewTarget(0, 3), 'the', 'Grammar'); dismissSuggestionReview()");
  assert.equal(h.context.field.value, 'teh cat');
  h.run("showSuggestionReview(captureReviewTarget(0, 3), 'the', 'Grammar')");
  h.context.field.value = 'my new draft';
  assert.equal(h.run('acceptSuggestionReview()'), false);
  assert.equal(h.context.field.value, 'my new draft');
  h.run("showSuggestionReview(captureReviewTarget(0, 2), 'a', 'Grammar'); acceptSuggestionReview()");
  h.context.field.value += '!';
  assert.equal(h.run('undoSuggestionReview()'), false);
  assert.equal(h.context.field.value, 'a new draft!');
});

test('batch review skips overlaps and supports deletions plus inverse offsets', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('teh  cat');
  h.run(`activeField = field; _lastCheckedText = field.value;
    reviewAllMatches([
      { offset: 0, length: 3, replacements: [{value: 'the'}] },
      { offset: 0, length: 2, replacements: [{value: 'NO'}] },
      { offset: 3, length: 1, replacements: [{value: ''}] }
    ])`);
  assert.equal(h.context.field.value, 'teh  cat');
  assert.equal(h.run('acceptSuggestionReview()'), true);
  assert.equal(h.context.field.value, 'the cat');
  assert.equal(h.run('undoSuggestionReview()'), true);
  assert.equal(h.context.field.value, 'teh  cat');
});

test('sentence AI response waits for explicit review and preserves request target', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('teh cat. Next.');
  h.context.chrome.runtime.sendMessage = async () => ({ suggestion: 'The cat.' });
  h.run('activeField = field; _lastCheckedText = field.value');
  await h.run("rewriteSentence({offset: 0, length: 3}, 'Humanize')");
  assert.equal(h.context.field.value, 'teh cat. Next.');
  assert.equal(h.run('pendingReview.original'), 'teh cat.');
  h.run('acceptSuggestionReview()');
  assert.equal(h.context.field.value, 'The cat. Next.');
});

test('textarea selection uses field offsets including whitespace, not window selection', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('  the cat  ');
  h.context.field.setSelectionRange(1, 10);
  h.run('activeField = field');
  assert.equal(h.run('captureSelectionTarget().original'), ' the cat ');
});
