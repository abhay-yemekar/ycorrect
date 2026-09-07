import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './helpers/content-harness.js';

test('live site disable clears field and pending review, re-enable works without reload', async () => {
  const h = await contentHarness();
  h.context.field = new h.Field('teh cat');
  h.run("activeField = field; showSuggestionReview(captureReviewTarget(0,3), 'the', 'Grammar'); onSettingsChanged({disabledSites:{newValue:['test.invalid']}}, 'sync')");
  assert.equal(h.run('activeField'), null);
  assert.equal(h.run('pendingReview'), null);
  assert.equal(h.run('siteEnabled'), false);
  h.run("onSettingsChanged({disabledSites:{newValue:[]}}, 'sync')");
  assert.equal(h.run('siteEnabled'), true);
});

test('grammar disable invalidates requests and clears highlights without disabling site', async () => {
  const h = await contentHarness();
  h.run("currentMatches = [{offset:0,length:3}]; onSettingsChanged({grammarEnabled:{newValue:false}}, 'sync')");
  assert.equal(h.run('grammarEnabled'), false);
  assert.equal(h.run('siteEnabled'), true);
  assert.equal(h.run('currentMatches.length'), 0);
  assert.ok(h.run('grammarRequestId') > 0);
});
