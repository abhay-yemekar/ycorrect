/**
 * Integration tests: boot the real server on an ephemeral port.
 *
 * No external calls are made — only endpoints with offline-safe paths
 * (health, static files, validation failures, the empty-text grammar path).
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server/app.js';

let server;
let port;
let base;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

/** Raw GET — sends the path exactly as given, no URL normalization. */
function rawGet(pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

describe('API routes', () => {
  test('GET /api/health returns ok', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  test('POST /api/grammar with empty text returns no matches (offline path)', async () => {
    const res = await post('/api/grammar', JSON.stringify({ text: '' }));
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body).matches, []);
  });

  test('POST /api/grammar with whitespace text returns no matches', async () => {
    const res = await post('/api/grammar', JSON.stringify({ text: '   \n  ' }));
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body).matches, []);
  });

  test('POST with invalid JSON returns 400', async () => {
    const res = await post('/api/grammar', 'this is not json{');
    assert.equal(res.status, 400);
    assert.match(res.body, /Invalid JSON/);
  });

  test('unknown POST route returns 404', async () => {
    const res = await post('/api/nope', JSON.stringify({}));
    assert.equal(res.status, 404);
  });
});

describe('static files', () => {
  test('GET / serves index.html', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /yCorrect/);
  });

  test('frontend modules are served', async () => {
    const res = await fetch(`${base}/js/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
  });

  test('missing files return 404', async () => {
    const res = await rawGet('/does-not-exist.js');
    assert.equal(res.status, 404);
  });
});

describe('security', () => {
  test('path traversal is rejected with 403', async () => {
    assert.equal((await rawGet('/../.env')).status, 403);
    assert.equal((await rawGet('/..%2F.env')).status, 403);
    assert.equal((await rawGet('/..%2F..%2F.env')).status, 403);
  });

  test('dotfiles are never served (regression: /.env leaked the project env)', async () => {
    assert.equal((await rawGet('/.env')).status, 404);
    assert.equal((await rawGet('/.gitignore')).status, 404);
    assert.equal((await rawGet('/.git/config')).status, 404);
  });

  test('node_modules is never served', async () => {
    const res = await rawGet('/node_modules/eslint/package.json');
    assert.equal(res.status, 404);
  });

  test('malformed percent-encoding returns 400 (was 500)', async () => {
    assert.equal((await rawGet('/%')).status, 400);
    assert.equal((await rawGet('/%2')).status, 400);
    assert.equal((await rawGet('/js/%')).status, 400);
  });

  test('security headers are set on every response', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('CORS header is present (default open policy)', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.ok(res.headers.get('access-control-allow-origin'));
  });

  test('OPTIONS preflight returns 204', async () => {
    const res = await fetch(`${base}/api/ai`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });
});
