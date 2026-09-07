import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './helpers/content-harness.js';

test('exact repeated occurrence maps across recreated DOM text nodes without throwing', async () => {
  const h = await contentHarness();
  h.context.field = { nodes: [{ textContent: 'teh ' }, { textContent: 't' }, { textContent: 'eh' }] };
  const range = h.run("findMatchRange(field, {offset: 4, length: 3}, 'teh teh')");
  assert.equal(range.startContainer, h.context.field.nodes[0]);
  assert.equal(range.startOffset, 4);
  assert.equal(range.endContainer, h.context.field.nodes[2]);
  assert.equal(range.endOffset, 2);
  h.context.field.nodes = [{ textContent: 'teh teh' }];
  const recreated = h.run("findMatchRange(field, {offset: 4, length: 3}, 'teh teh')");
  assert.equal(recreated.startContainer, h.context.field.nodes[0]);
  assert.equal(recreated.startOffset, 4);
});

test('different DOM text or invisible characters never trigger a fuzzy wrong-word match', async () => {
  const h = await contentHarness();
  h.context.field = { nodes: [{ textContent: 'teh new teh' }] };
  assert.equal(h.run("findMatchRange(field, {offset: 4, length: 3}, 'teh teh')"), null);
  h.context.field.nodes = [{ textContent: 'teh \u200bteh' }];
  assert.equal(h.run("findMatchRange(field, {offset: 4, length: 3}, 'teh teh')"), null);
});

test('actual renderHighlights path creates shadow underlines and skips stale text', async () => {
  const h = await contentHarness();
  h.context.field = { nodes: [{ textContent: 'teh' }], tagName: 'DIV' };
  h.run("activeField = field; _lastCheckedText = 'teh'; currentMatches = [{offset: 0, length: 3}]; renderHighlights()");
  assert.equal(h.run('highlightsContainer.children.length'), 1);
  assert.equal(h.run('highlightsContainer.children[0].dataset.matchOffset'), '0');
  h.run("_lastCheckedText = 'different'; highlightsContainer = null; renderHighlights()");
  assert.equal(h.run('highlightsContainer'), null);
});

test('grammar responses are discarded after field switch or text edits', async () => {
  const h = await contentHarness();
  const first = new h.Field('teh cat');
  h.context.field = first;
  h.run('activeField = field');
  let resolve;
  h.context.chrome.runtime.sendMessage = () => new Promise(r => { resolve = r; });
  const pending = h.run('runGrammarCheck()');
  h.context.other = new h.Field('other text');
  h.run('activeField = other');
  resolve({ matches: [{ offset: 0, length: 3 }] });
  await pending;
  assert.equal(h.run('currentMatches.length'), 0);
  h.run('activeField = field');
  const changed = h.run('runGrammarCheck()');
  first.value = 'new text';
  resolve({ matches: [{ offset: 0, length: 3 }] });
  await changed;
  assert.equal(h.run('currentMatches.length'), 0);
});
