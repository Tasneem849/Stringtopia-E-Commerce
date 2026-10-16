import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/middleware/rateLimit.js';

test('blocks a visitor after too many requests but not other visitors', () => {
  const limit = rateLimit({ windowMs: 60000, max: 3 });
  let status = 0;
  const headers = {};
  const res = { set(name, value) { headers[name] = value; return this; }, status(code) { status = code; return this; }, json() {} };
  let allowed = 0;
  for (let i = 0; i < 5; i++) limit({ ip: '1.2.3.4', headers: {} }, res, () => allowed++);
  assert.equal(allowed, 3);
  assert.equal(status, 429);
  assert.equal(headers['Retry-After'], '60');
  let other = 0;
  limit({ ip: '5.6.7.8', headers: {} }, res, () => other++);
  assert.equal(other, 1);
});

test('applies the same limit independently to every generated key', () => {
  const limit = rateLimit({ windowMs: 60000, max: 1, keyGenerator: (req) => [`ip:${req.ip}`, `email:${req.email}`] });
  const res = { set() { return this; }, status() { return this; }, json() {} };
  let allowed = 0;
  limit({ ip: '1.2.3.4', email: 'a@example.com' }, res, () => allowed++);
  limit({ ip: '5.6.7.8', email: 'a@example.com' }, res, () => allowed++);
  assert.equal(allowed, 1);
});
