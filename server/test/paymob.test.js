import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckout, inquireTransactionByReference, isValidHmac } from '../src/paymob.js';
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
  const calls = stubPaymob({ ok: true, json: async () => ({ client_secret: 'egy_csk_test_z', intention_order_id: 12345 }) });
  const checkout = await createCheckout(order, 2);
  const { body, opts } = calls[0];
  assert.equal(checkout.url, 'https://accept.paymob.com/unifiedcheckout/?publicKey=egy_pk_test_y&clientSecret=egy_csk_test_z');
  assert.equal(checkout.paymobOrderId, 12345);
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

test('payment request: promo savings are allocated across products and line totals match the discounted amount', async () => {
  const calls = stubPaymob({ ok: true, json: async () => ({ client_secret: 'egy_csk_test_z', intention_order_id: 12345 }) });
  const promoOrder = {
    ...order,
    total: 15000,
    discountAmount: 1000,
    items: [
      { qty: 2, name: 'Daisy Amigurumi', price: 3000 },
      { qty: 1, name: 'Tulip Pouch', price: 5000 },
    ],
  };
  await createCheckout(promoOrder, 1);
  const { body } = calls[0];
  assert.deepEqual(body.items.map(({ name, amount }) => ({ name, amount })), [
    { name: '2 x Daisy Amigurumi', amount: 5455 },
    { name: '1 x Tulip Pouch', amount: 4545 },
    { name: 'Delivery', amount: 5000 },
  ]);
  assert.equal(body.items.reduce((sum, item) => sum + item.amount * item.quantity, 0), body.amount);
  assert.equal(body.amount, 15000);
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

test('transaction inquiry authenticates with the merchant API key and uses the merchant reference', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PAYMOB_API_KEY;
  const calls = [];
  process.env.PAYMOB_API_KEY = 'merchant-api-key';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith('/api/auth/tokens')) return { ok: true, status: 200, json: async () => ({ token: 'inquiry-token' }) };
    return { ok: true, status: 200, json: async () => ({ id: 987, amount_cents: 11000, success: true, pending: false }) };
  };
  try {
    const result = await inquireTransactionByReference('abc123-2');
    assert.equal(calls[0].body.api_key, 'merchant-api-key');
    assert.equal(calls[1].body.auth_token, 'inquiry-token');
    assert.equal(calls[1].body.merchant_order_id, 'abc123-2');
    assert.equal(result.amount_cents, 11000);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PAYMOB_API_KEY;
    else process.env.PAYMOB_API_KEY = originalKey;
  }
});

test('transaction inquiry distinguishes no transaction from an unavailable inquiry', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PAYMOB_API_KEY;
  process.env.PAYMOB_API_KEY = 'merchant-api-key';
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  try {
    assert.equal(await inquireTransactionByReference('unpaid-attempt-1'), null);
    delete process.env.PAYMOB_API_KEY;
    await assert.rejects(inquireTransactionByReference('unpaid-attempt-1'), /PAYMOB_API_KEY is not configured/);
    process.env.PAYMOB_API_KEY = 'merchant-api-key';
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(inquireTransactionByReference('unpaid-attempt-1'), /failed with status 503/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PAYMOB_API_KEY;
    else process.env.PAYMOB_API_KEY = originalKey;
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

test('callback signature remains valid if merchant_order_id is changed, so it cannot identify the database order', () => {
  const genuine = paymobCallback(order);
  const redirected = paymobCallback(order, {
    order: { ...genuine.obj.order, merchant_order_id: `${'b'.repeat(24)}-1` },
  });
  assert.equal(redirected.hmac, genuine.hmac);
  assert.equal(isValidHmac(redirected.obj, genuine.hmac), true);
});
