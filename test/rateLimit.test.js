/**
 * Tests for the rate limiter (server/middleware/rateLimit.js).
 * Covers the fixed window, per-IP isolation, and per-limiter counters.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../server/middleware/rateLimit.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function fakeReq(ip) {
  return { socket: { remoteAddress: ip }, headers: {} };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
  };
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    Object.assign(res.headers, headers || {});
  };
  res.end = (body) => {
    if (body) res.body = String(body);
  };
  return res;
}

describe('createRateLimiter', () => {
  test('allows up to max requests, then blocks with 429', async () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 80 });
    const ip = '10.0.0.1';

    assert.equal(limiter(fakeReq(ip), fakeRes()), false);
    assert.equal(limiter(fakeReq(ip), fakeRes()), false);

    const blocked = fakeRes();
    assert.equal(limiter(fakeReq(ip), blocked), true);
    assert.equal(blocked.statusCode, 429);
    assert.ok(blocked.headers['Retry-After']);
    assert.match(blocked.body, /error/);

    // Window elapses → allowed again
    await sleep(100);
    assert.equal(limiter(fakeReq(ip), fakeRes()), false);
  });

  test('different IPs have independent budgets', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    assert.equal(limiter(fakeReq('10.0.0.2'), fakeRes()), false);
    assert.equal(limiter(fakeReq('10.0.0.2'), fakeRes()), true);
    assert.equal(limiter(fakeReq('10.0.0.3'), fakeRes()), false);
  });

  test('limiter instances have independent counters', () => {
    const a = createRateLimiter({ max: 1, windowMs: 60_000 });
    const b = createRateLimiter({ max: 1, windowMs: 60_000 });

    assert.equal(a(fakeReq('10.0.0.4'), fakeRes()), false);
    assert.equal(a(fakeReq('10.0.0.4'), fakeRes()), true, 'a should be exhausted');

    assert.equal(b(fakeReq('10.0.0.4'), fakeRes()), false, 'b must not share state with a');
  });

  test('x-forwarded-for is ignored unless TRUST_PROXY is set (defect 15)', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    const proxied = { socket: { remoteAddress: '10.0.0.9' }, headers: { 'x-forwarded-for': '1.2.3.4' } };

    assert.equal(limiter(proxied, fakeRes()), false);
    // Keyed by the socket address — the client-supplied header must not
    // rotate the bucket:
    assert.equal(limiter(proxied, fakeRes()), true);
    assert.equal(
      limiter({ socket: { remoteAddress: '10.0.0.10' }, headers: { 'x-forwarded-for': '1.2.3.4' } }, fakeRes()),
      false
    );
  });

  test('TRUST_PROXY=1 keys on the x-forwarded-for client IP', () => {
    process.env.TRUST_PROXY = '1';
    try {
      const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
      const req = { socket: { remoteAddress: '10.0.0.9' }, headers: { 'x-forwarded-for': '1.2.3.4' } };
      assert.equal(limiter(req, fakeRes()), false);
      assert.equal(limiter(req, fakeRes()), true);
      // Different client behind the same proxy → own bucket:
      assert.equal(
        limiter({ socket: { remoteAddress: '10.0.0.9' }, headers: { 'x-forwarded-for': '5.6.7.8' } }, fakeRes()),
        false
      );
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});
