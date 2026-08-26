/**
 * Tests for server/services/gemini.js.
 * Defect 12: the API key must travel in the x-goog-api-key header,
 * never in the query string (URLs leak into logs and crash reports).
 *
 * fetch is mocked — no external calls are made.
 */

import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../server/services/gemini.js';

const KEY = 'test-key-never-real';

function fakeGeminiResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

describe('gemini.generate', () => {
  test('sends the key as a header and keeps it out of the URL', async () => {
    process.env.GEMINI_API_KEY = KEY;
    const calls = [];
    const stub = mock.method(globalThis, 'fetch', async (url, opts) => {
      calls.push({ url: String(url), headers: opts.headers });
      return fakeGeminiResponse('result text');
    });

    try {
      const out = await generate('do a thing', 0.4);
      assert.equal(out, 'result text');

      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.endsWith(':generateContent'), 'hits the generateContent endpoint');
      assert.ok(!calls[0].url.includes(KEY), 'key must NOT appear in the URL');
      assert.equal(calls[0].headers['x-goog-api-key'], KEY);
      assert.equal(calls[0].headers['Content-Type'], 'application/json');
    } finally {
      stub.mock.restore();
      delete process.env.GEMINI_API_KEY;
    }
  });

  test('clamps temperature into 0–1', async () => {
    process.env.GEMINI_API_KEY = KEY;
    const calls = [];
    const stub = mock.method(globalThis, 'fetch', async (url, opts) => {
      calls.push(JSON.parse(opts.body));
      return fakeGeminiResponse('x');
    });

    try {
      await generate('p', 99);
      assert.equal(calls[0].generationConfig.temperature, 1);
      await generate('p', -5);
      assert.equal(calls[1].generationConfig.temperature, 0);
    } finally {
      stub.mock.restore();
      delete process.env.GEMINI_API_KEY;
    }
  });

  test('throws a clear error when the key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(() => generate('p'), /GEMINI_API_KEY/);
  });
});
