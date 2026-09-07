import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './helpers/content-harness.js';

test('debounce coalesces keystrokes and successful unchanged checks are deduplicated', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('the cat');
  h.run('activeField = field; renderHighlights = () => {}');
  let requests = 0;
  h.context.chrome.runtime.sendMessage = async () => { requests++; return { matches: [] }; };
  h.run('scheduleGrammarCheck(); scheduleGrammarCheck(); scheduleGrammarCheck()');
  assert.equal(h.timers.size, 1);
  await h.run('runGrammarCheck()');
  await h.run('runGrammarCheck()');
  assert.equal(requests, 1);
});

test('short fields release spinner and rewrite cancellation suppresses late responses', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('x');
  h.run('activeField = field');
  await h.run('runGrammarCheck()');
  assert.equal(h.run('grammarSpinnerEl.style.display'), 'none');
  h.context.field.value = 'the cat';
  let resolve;
  h.context.chrome.runtime.sendMessage = () => new Promise(r => { resolve = r; });
  const request = h.run("requestReviewRewrite(captureReviewTarget(0, 7), 'Humanize')");
  assert.match(h.run('rewriteLoadingEl.innerHTML'), /Preparing rewrite/);
  h.run('cancelPendingRewrite()');
  resolve({ suggestion: 'A cat' });
  await request;
  assert.equal(h.run('rewriteLoadingEl'), null);
  assert.equal(h.run('pendingReview'), null);
  assert.equal(h.context.field.value, 'the cat');
});
