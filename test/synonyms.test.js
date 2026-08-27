/**
 * Tests for /api/synonyms — validates input sanitization, query parsing,
 * and response shape. Does NOT make external calls to DataMuse; the route
 * is tested with mocked fetch behavior via the integration test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/app.js';

describe('synonyms route', () => {
  let server;
  let baseUrl;

  const startServer = () =>
    new Promise((resolve) => {
      server = createServer();
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

  const stopServer = () =>
    new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });

  import('node:test').then(({ before, after }) => {
    before(startServer);
    after(stopServer);
  });

  it('returns empty arrays for empty word', async () => {
    const res = await fetch(`${baseUrl}/api/synonyms?word=`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.synonyms, []);
    assert.deepEqual(data.antonyms, []);
    assert.deepEqual(data.definitions, []);
  });

  it('returns empty arrays for invalid characters', async () => {
    const res = await fetch(`${baseUrl}/api/synonyms?word=<script>alert(1)</script>`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.synonyms, []);
  });

  it('returns empty arrays for words > 50 chars', async () => {
    const longWord = 'a'.repeat(51);
    const res = await fetch(`${baseUrl}/api/synonyms?word=${longWord}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.synonyms, []);
  });

  it('accepts valid lowercase words', async () => {
    const res = await fetch(`${baseUrl}/api/synonyms?word=hello`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.word, 'hello');
    assert.ok(Array.isArray(data.synonyms));
    assert.ok(Array.isArray(data.antonyms));
    assert.ok(Array.isArray(data.definitions));
  });

  it('accepts words with hyphens and apostrophes', async () => {
    const res = await fetch(`${baseUrl}/api/synonyms?word=don't`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.word, 'string');
  });

  it('handles missing word parameter', async () => {
    const res = await fetch(`${baseUrl}/api/synonyms`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.synonyms, []);
  });
});
