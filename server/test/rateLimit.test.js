import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/middleware/rateLimit.js';

test('blocks a visitor after too many requests but not other visitors', () => {
  const limit = rateLimit({ windowMs: 60000, max: 3 });
  let status = 0;
  const res = { status(code) { status = code; return this; }, json() {} };
  let allowed = 0;
  for (let i = 0; i < 5; i++) limit({ ip: '1.2.3.4' }, res, () => allowed++);
  assert.equal(allowed, 3);
  assert.equal(status, 429);
  let other = 0;
  limit({ ip: '5.6.7.8' }, res, () => other++);
  assert.equal(other, 1);
});
