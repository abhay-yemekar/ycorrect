import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function worker(fetch) {
  let handler;
  const context = vm.createContext({ fetch, URL, AbortSignal,
    chrome: {
      storage: { sync: { get: async () => ({ serverUrl: 'http://localhost:3000' }) } },
      runtime: { onInstalled: { addListener() {} }, onMessage: { addListener(fn) { handler = fn; } } },
      contextMenus: { onClicked: { addListener() {} } },
    },
  });
  vm.runInContext(readFileSync(new URL('../../apps/extension/background.js', import.meta.url), 'utf8'), context);
  return message => new Promise(resolve => handler(message, {}, resolve));
}

test('HTTP failures remain explicit grammar/rewrite errors', async () => {
  for (const type of ['checkGrammar', 'rewrite']) {
    const send = worker(async () => ({ ok: false, status: 503 }));
    const response = await send({ type, text: 'test' });
    assert.match(response.error, /503/);
    assert.equal(response.matches, undefined);
    assert.equal(response.suggestion, undefined);
  }
});

test('network failures are not disguised as clean writing', async () => {
  const send = worker(async () => { throw new Error('offline'); });
  assert.match((await send({ type: 'checkGrammar', text: 'test' })).error, /Could not reach/);
  assert.match((await send({ type: 'rewrite', text: 'test' })).error, /Could not reach/);
});
