import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './helpers/content-harness.js';

test('review shortcuts accept and undo while preserving native Ctrl+Z and composition', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('teh cat');
  h.context.document.activeElement = h.context.field;
  h.run("activeField = field; showSuggestionReview(captureReviewTarget(0,3), 'the', 'Grammar')");
  let prevented = 0;
  h.context.event = { key: 'Enter', ctrlKey: true, altKey: true, preventDefault() { prevented++; } };
  h.run('onKeyDown(event)');
  assert.equal(h.context.field.value, 'the cat');
  h.context.event.key = 'z';
  h.context.event.altKey = false;
  h.run('onKeyDown(event)');
  assert.equal(prevented, 1);
  h.context.event.altKey = true;
  h.context.event.isComposing = true;
  h.run('onKeyDown(event)');
  assert.equal(h.context.field.value, 'the cat');
  h.context.event.isComposing = false;
  h.run('onKeyDown(event)');
  assert.equal(h.context.field.value, 'teh cat');
});
