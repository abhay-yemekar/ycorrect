/**
 * Tests for the overlay renderer (js/editor.js → renderOverlayHtml).
 * The function is pure so the offset arithmetic is verified in Node.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOverlayHtml } from '../js/editor.js';

const issue = (offset, length, rule = {}) => ({ offset, length, rule });

describe('renderOverlayHtml', () => {
  test('wraps exactly the issue range in a red span for grammar', () => {
    const html = renderOverlayHtml('hello cruel world', [
      issue(6, 5, { issueType: 'grammar' }),
    ]);
    assert.equal(html, 'hello <span class="u u-red" data-i="0">cruel</span> world\n');
  });

  test('misspellings are red', () => {
    const html = renderOverlayHtml('teh cat', [issue(0, 3, { issueType: 'misspelling' })]);
    assert.match(html, /u-red/);
  });

  test('style issues are yellow', () => {
    const html = renderOverlayHtml('hello  world', [
      issue(5, 2, { issueType: 'style', category: { name: 'Typography' } }),
    ]);
    assert.match(html, /u-yellow/);
  });

  test('other issues are blue (clarity)', () => {
    const html = renderOverlayHtml('some text', [issue(0, 4, { issueType: 'other' })]);
    assert.match(html, /u-blue/);
  });

  test('an issue spanning a newline renders on both lines', () => {
    const html = renderOverlayHtml('one two\nthree four', [issue(4, 9, { issueType: 'grammar' })]);
    const lines = html.split('\n');
    assert.match(lines[0], /<span class="u u-red" data-i="0">two<\/span>/);
    assert.match(lines[1], /<span class="u u-red" data-i="0">three<\/span>/);
  });

  test('overlapping issues resolve to the highest severity per segment', () => {
    const html = renderOverlayHtml('aaa bbb', [
      issue(0, 7, { issueType: 'style' }),      // yellow, whole range
      issue(4, 3, { issueType: 'grammar' }),    // red, second word
    ]);
    assert.match(html, /u-yellow[^>]*>aaa /);
    assert.match(html, /u-red[^>]*>bbb<\/span>/);
  });

  test('text is HTML-escaped', () => {
    const html = renderOverlayHtml('<b>bold</b> & "quoted"', []);
    assert.equal(html, '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;\n');
  });

  test('data-i reflects the index in the issues array', () => {
    const html = renderOverlayHtml('aa bb cc', [
      issue(0, 2, { issueType: 'grammar' }),
      issue(6, 2, { issueType: 'grammar' }),
    ]);
    assert.match(html, /data-i="0">aa<\/span>/);
    assert.match(html, /data-i="1">cc<\/span>/);
  });

  test('empty text renders a single newline (one empty line)', () => {
    assert.equal(renderOverlayHtml('', []), '\n');
  });
});
