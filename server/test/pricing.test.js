import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feeFor, sumTotal, toEgPhone } from '../src/pricing.js';

test('delivery has the configured fee, pickup is always free', () => {
  process.env.DELIVERY_FEE = '5000';
  assert.equal(feeFor({ method: 'delivery' }), 5000);
  assert.equal(feeFor({ method: 'pickup' }), 0);
  delete process.env.DELIVERY_FEE;
  assert.equal(feeFor({ method: 'delivery' }), 0);
});

test('order totals multiply price by quantity', () => {
  assert.equal(sumTotal([{ price: 3000, qty: 2 }, { price: 1250, qty: 1 }]), 7250);
});

test('Egyptian mobile numbers are normalised to +20 format', () => {
  assert.equal(toEgPhone('01012345678'), '+201012345678');
  assert.equal(toEgPhone('(010) 1234-5678'), '+201012345678');
  assert.equal(toEgPhone('201012345678'), '+201012345678');
  assert.equal(toEgPhone('+20 101 234 5678'), '+201012345678');
  assert.equal(toEgPhone('+441234567890'), '+441234567890');
});
