/**
 * Tests for the document backup merge logic (js/documents.js).
 * These are pure functions — no browser APIs touched at module scope.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportedDoc, mergeDocsForImport } from '../js/documents.js';

let seq = 0;
const idFactory = () => `test-id-${++seq}`;

describe('normalizeImportedDoc', () => {
  test('keeps a well-formed document as-is', () => {
    const doc = {
      id: 'abc', name: 'Essay', text: 'hello',
      updatedAt: 1000, ignoredIssues: ['x|y'],
    };
    assert.deepEqual(normalizeImportedDoc(doc), doc);
  });

  test('rejects non-objects and documents without text', () => {
    assert.equal(normalizeImportedDoc(null), null);
    assert.equal(normalizeImportedDoc('nope'), null);
    assert.equal(normalizeImportedDoc({ name: 'no text' }), null);
    assert.equal(normalizeImportedDoc({ text: 42 }), null);
  });

  test('fills missing fields with safe defaults', () => {
    const doc = normalizeImportedDoc({ text: 'hi' }, idFactory);
    assert.equal(doc.id, 'test-id-1');
    assert.equal(doc.name, 'Untitled document');
    assert.deepEqual(doc.ignoredIssues, []);
    assert.ok(Number.isFinite(doc.updatedAt));
  });

  test('drops non-string ignore keys and blank names', () => {
    const doc = normalizeImportedDoc({
      text: '', name: '   ', ignoredIssues: ['ok|key', 42, null],
    }, idFactory);
    assert.equal(doc.name, 'Untitled document');
    assert.deepEqual(doc.ignoredIssues, ['ok|key']);
  });
});

describe('mergeDocsForImport', () => {
  const existing = [
    { id: 'a', name: 'Mine A', text: 'aaa', updatedAt: 300 },
    { id: 'b', name: 'Mine B', text: 'bbb', updatedAt: 100 },
  ];

  test('adds new ids and sorts the library by recency', () => {
    const incoming = [{ id: 'c', name: 'Theirs C', text: 'ccc', updatedAt: 200 }];
    const { docs, added, merged } = mergeDocsForImport(existing, incoming);
    assert.deepEqual(docs.map(d => d.name), ['Mine A', 'Theirs C', 'Mine B']);
    assert.equal(added, 1);
    assert.equal(merged, 0);
  });

  test('never overwrites an existing id — collision becomes a copy', () => {
    const incoming = [{ id: 'a', name: 'Theirs A', text: 'zzz', updatedAt: 1 }];
    const { docs, added, merged } = mergeDocsForImport(existing, incoming, idFactory);
    assert.equal(docs.find(d => d.text === 'aaa').id, 'a'); // ours untouched
    assert.equal(merged, 1);
    assert.equal(added, 0);
    assert.ok(docs.find(d => d.name === 'Theirs A (imported)'));
  });

  test('skips malformed entries entirely', () => {
    const incoming = [null, 'junk', { name: 'still no text' }, { id: 'd', text: 'ok' }];
    const { docs } = mergeDocsForImport(existing, incoming);
    assert.equal(docs.length, 3);
  });

  test('empty import leaves the library unchanged', () => {
    const { docs, added, merged } = mergeDocsForImport(existing, []);
    assert.equal(docs.length, 2);
    assert.equal(added + merged, 0);
  });
});
