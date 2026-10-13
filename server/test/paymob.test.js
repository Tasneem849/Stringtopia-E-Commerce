import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, isValidHmac } from '../src/paymob.js';
import { paymobCallback } from '../testkit/paymobCallback.js';

Object.assign(process.env, {
  PAYMOB_SECRET_KEY: 'egy_sk_test_x', PAYMOB_PUBLIC_KEY: 'egy_pk_test_y', PAYMOB_INTEGRATION_IDS: '111, 222',
  PAYMOB_HMAC_SECRET: 'shh', API_URL: 'https://api.example.com', CLIENT_URL: 'http://localhost:3000', CURRENCY: 'EGP',
});
const order = {
  id: 'a'.repeat(24), total: 11000, shippingFee: 5000, publicToken: 'tok123', email: 'mona@example.com',
  customer: { name: 'Mona Ali Hassan', phone: '+201012345678' }, items: [{ qty: 2, name: 'Daisy Amigurumi', price: 3000 }],
};
// Nothing here talks to Paymob: fetch is replaced by a stub that records the request
const stubPaymob = (response) => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts, body: JSON.parse(opts.body) }); return response; };
  return calls;
};

test('payment request: lines add up to the amount, and billing details and references are set', async () => {
  const calls = stubPaymob({ ok: true, json: async () => ({ client_secret: 'egy_csk_test_z' }) });
  const url = await createCheckout(order, 2);
  const { body, opts } = calls[0];
  assert.equal(url, 'https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test_y&clientSecret=egy_csk_test_z');
  assert.equal(opts.headers.Authorization, 'Token egy_sk_test_x');
  assert.equal(body.amount, 11000);
  assert.equal(body.currency, 'EGP');
  assert.deepEqual(body.payment_methods, [111, 222]);
  assert.equal(body.items.reduce((sum, i) => sum + i.amount * i.quantity, 0), body.amount);
  assert.equal(body.billing_data.first_name, 'Mona');
  assert.equal(body.billing_data.last_name, 'Ali Hassan');
  assert.equal(body.special_reference, `${order.id}-2`);
  assert.equal(body.notification_url, 'https://api.example.com/api/orders/webhook');
  assert.equal(body.redirection_url, 'http://localhost:3000/thanks?ref=tok123');
});

test('payment request: a one-word name still works', async () => {
  const calls = stubPaymob({ ok: true, json: async () => ({ client_secret: 'x' }) });
  await createCheckout({ ...order, customer: { name: 'Mona', phone: '+201012345678' } }, 1);
  assert.equal(calls[0].body.billing_data.last_name, 'NA');
});

test('payment request: a Paymob error becomes a clean 502', async () => {
  stubPaymob({ ok: false, status: 400, json: async () => ({ detail: 'bad request' }) });
  const log = console.error;
  console.error = () => {};
  try {
    await assert.rejects(() => createCheckout(order, 1), (e) => e.status === 502);
  } finally {
    console.error = log;
  }
});

test('payment request: refuses when Paymob is not configured', async () => {
  const key = process.env.PAYMOB_SECRET_KEY;
  delete process.env.PAYMOB_SECRET_KEY;
  try {
    await assert.rejects(() => createCheckout(order, 1), (e) => e.status === 503);
  } finally {
    process.env.PAYMOB_SECRET_KEY = key;
  }
});

test('callback signature: accepts a genuine one, rejects tampering, the wrong secret and nothing at all', () => {
  const { obj, hmac } = paymobCallback(order);
  assert.equal(isValidHmac(obj, hmac), true);
  assert.equal(isValidHmac({ ...obj, amount_cents: 1 }, hmac), false);
  assert.equal(isValidHmac(obj, paymobCallback(order, {}, 'other-secret').hmac), false);
  assert.equal(isValidHmac(obj, undefined), false);
  assert.equal(isValidHmac(undefined, hmac), false);
});
