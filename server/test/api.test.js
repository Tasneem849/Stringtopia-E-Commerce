import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { paymobCallback } from '../testkit/paymobCallback.js';

// API integration tests require an explicit test-only URI and use a fresh database per run.
// Never fall back to MONGO_URI: that value is commonly the application's shared database.
const TEST_MONGO_URI = process.env.TEST_MONGO_URI;
const RUN = Boolean(TEST_MONGO_URI);
const TEST_DATABASE_NAME = `stringtopia_test_${process.pid}_${crypto.randomBytes(6).toString('hex')}`;
// Fixed test-only key; never reuse this value outside the integration suite.
const ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function adminTotpCode(now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...ADMIN_TOTP_SECRET].map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, index) => Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

describe('API', { skip: !RUN && 'set TEST_MONGO_URI to a dedicated test MongoDB connection to run these' }, () => {
  let server, base, mongoose, Product, User, Order, AdminAuditLog, RateLimitBucket, sweep, adminToken, realFetch;
  const paymobCalls = [];
  const refundCalls = [];
  const paymobTransactions = new Map();
  let counter = 0;
  let nextPaymobOrderId = 12345;
  let paymobReferenceInquiryStatus = 404;

  const call = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const newProduct = (over = {}) => Product.create({ name: `Piece ${++counter}`, price: 10000, stock: 5, ...over });
  const register = async (email) => {
    const credentials = { email, password: 'password123' };
    const registration = await call('/api/auth/register', { method: 'POST', body: credentials });
    if (registration.status !== 202) throw new Error(`Could not complete test registration (${registration.status})`);
    return (await call('/api/auth/login', { method: 'POST', body: credentials })).body.token;
  };
  const giftDelivery = {
    method: 'delivery', gift: true, recipientName: 'Mona Ali', phone: '01012345678', giftMessage: 'Happy birthday',
    address: { line1: '1 Nile St', city: 'Cairo', country: 'Egypt' },
  };
  const checkout = (items, email = 'guest@test.com', delivery = giftDelivery, extra = {}) => call('/api/orders/checkout', {
    method: 'POST', body: { items, delivery, customer: { name: 'Sara Hassan', phone: '01112345678', email }, ...extra },
  });
  const sendCallback = ({ obj, hmac }) => {
    if (obj?.id != null && !paymobTransactions.has(String(obj.id))) {
      paymobTransactions.set(String(obj.id), {
        id: obj.id,
        amount_cents: obj.amount_cents,
        success: obj.success,
        pending: obj.pending,
        is_voided: obj.is_voided,
        is_refunded: obj.is_refunded,
        order: obj.order ? { ...obj.order } : undefined,
      });
    }
    return call(`/api/orders/webhook?hmac=${hmac}`, { method: 'POST', body: { type: 'TRANSACTION', obj } });
  };
  const reserveAs = (token, items) => call('/api/orders/reserve', {
    method: 'POST', token, body: { items, delivery: { method: 'pickup' }, customer: { name: 'Nour Adel', phone: '01234567890' }, note: 'Pink please' },
  });

  before(async () => {
    Object.assign(process.env, {
      JWT_SECRET: 'test-secret', ADMIN_TOTP_SECRET, RATE_LIMIT_PROXY_SECRET: 'test-rate-limit-proxy-secret-at-least-32-characters',
      CLIENT_URL: 'http://localhost:3000', API_URL: 'https://api.example.com', CURRENCY: 'EGP',
      DELIVERY_FEE: '5000', PICKUP_ADDRESS: '1 Test Street', PAYMOB_API_KEY: 'merchant-test-api-key',
      PAYMOB_SECRET_KEY: 'egy_sk_test_x', PAYMOB_PUBLIC_KEY: 'egy_pk_test_y', PAYMOB_BASE_URL: 'https://accept.paymob.com',
      PAYMOB_HMAC_SECRET: 'test-hmac', PAYMOB_INTEGRATION_IDS: '111',
    });
    delete process.env.SMTP_HOST;
    // Play the part of Paymob; every other request goes through for real
    realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const target = String(url);
      if (target.endsWith('/v1/intention/')) {
        paymobCalls.push(JSON.parse(opts.body));
        return { ok: true, json: async () => ({ client_secret: 'egy_csk_test_z', intention_order_id: nextPaymobOrderId++ }) };
      }
      const inquiryMatch = target.match(/\/api\/acceptance\/transactions\/([^/?]+)/);
      if (inquiryMatch) {
        const transaction = paymobTransactions.get(decodeURIComponent(inquiryMatch[1]));
        return transaction
          ? { ok: true, json: async () => transaction }
          : { ok: false, status: 404, json: async () => ({}) };
      }
      if (target.endsWith('/api/ecommerce/orders/transaction_inquiry')) {
        return {
          ok: paymobReferenceInquiryStatus < 400,
          status: paymobReferenceInquiryStatus,
          json: async () => ({}),
        };
      }
      if (target.endsWith('/api/acceptance/void_refund/refund')) {
        refundCalls.push(JSON.parse(opts.body));
        return { ok: true, json: async () => ({ id: 98765 }) };
      }
      if (target.endsWith('/api/auth/tokens')) return { ok: true, json: async () => ({ token: 'merchant-test-token' }) };
      if (target.includes('accept.paymob.com')) return { ok: true, json: async () => ({}) };
      return realFetch(url, opts);
    };
    mongoose = (await import('mongoose')).default;
    Product = (await import('../src/models/Product.js')).default;
    User = (await import('../src/models/User.js')).default;
    Order = (await import('../src/models/Order.js')).default;
    AdminAuditLog = (await import('../src/models/AdminAuditLog.js')).default;
    RateLimitBucket = (await import('../src/models/RateLimitBucket.js')).default;
    const { app } = await import('../src/app.js');
    ({ sweep } = await import('../src/routes/orders.js'));

    // The URI supplies the MongoDB host and credentials only. dbName overrides any database
    // in the URI, so every run writes to a new disposable database and never the app database.
    await mongoose.connect(TEST_MONGO_URI, { dbName: TEST_DATABASE_NAME });
    if (mongoose.connection.name !== TEST_DATABASE_NAME) {
      throw new Error('Refusing to run API tests because the isolated test database was not selected.');
    }
    await Promise.all([Product.init(), User.init(), Order.init(), AdminAuditLog.init(), RateLimitBucket.init()]);
    await Promise.all([Product, User, Order, AdminAuditLog, RateLimitBucket].map((m) => m.deleteMany({})));
    await User.create({ name: 'Admin', email: 'admin@test.com', password: 'adminpass1', role: 'admin' });

    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    adminToken = (await call('/api/auth/admin/login', {
      method: 'POST', body: { email: 'admin@test.com', password: 'adminpass1', totpCode: adminTotpCode() },
    })).body.token;
  });
  beforeEach(async () => {
    paymobCalls.length = 0;
    refundCalls.length = 0;
    paymobTransactions.clear();
    nextPaymobOrderId = 12345;
    paymobReferenceInquiryStatus = 404;
    await Promise.all([Product.deleteMany({}), Order.deleteMany({}), AdminAuditLog.deleteMany({}), RateLimitBucket.deleteMany({})]);
  });
  after(async () => {
    if (realFetch) globalThis.fetch = realFetch;
    if (server) { server.close(); server.closeAllConnections?.(); }
    try {
      // Drop only this run's generated database, and only after confirming its exact name.
      if (mongoose?.connection?.readyState === 1 && mongoose.connection.name === TEST_DATABASE_NAME) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose?.disconnect();
    }
  });

  test('accounts: registration responses do not disclose existing emails and invalid login is generic', async () => {
    const body = { email: 'a@test.com', password: 'password123' };
    const firstRegistration = await call('/api/auth/register', { method: 'POST', body });
    const repeatedRegistration = await call('/api/auth/register', { method: 'POST', body });
    assert.equal(firstRegistration.status, 202);
    assert.equal(repeatedRegistration.status, 202);
    assert.deepEqual(repeatedRegistration.body, firstRegistration.body);
    assert.ok((await call('/api/auth/login', { method: 'POST', body })).body.token);
    const wrongPassword = await call('/api/auth/login', { method: 'POST', body: { ...body, password: 'wrongpass99' } });
    const missingEmail = await call('/api/auth/login', { method: 'POST', body: { email: 'missing@test.com', password: 'wrongpass99' } });
    assert.equal(wrongPassword.status, 401);
    assert.equal(missingEmail.status, 401);
    assert.deepEqual(missingEmail.body, wrongPassword.body);
  });

  test('admin sign-in requires a valid authenticator code after the password', async () => {
    const credentials = { email: 'admin@test.com', password: 'adminpass1' };
    const customerLogin = await call('/api/auth/login', { method: 'POST', body: credentials });
    assert.equal(customerLogin.status, 401);
    assert.equal(customerLogin.body.code, 'INVALID_CREDENTIALS');

    const missing = await call('/api/auth/admin/login', { method: 'POST', body: credentials });
    assert.equal(missing.status, 401);
    assert.equal(missing.body.code, 'ADMIN_MFA_REQUIRED');

    const now = Date.now();
    const validCodes = new Set([-60_000, -30_000, 0, 30_000, 60_000].map((offset) => adminTotpCode(now + offset)));
    const validCode = adminTotpCode(now);
    let invalidCode = '000000';
    while (validCodes.has(invalidCode)) invalidCode = String((Number(invalidCode) + 1) % 1_000_000).padStart(6, '0');
    const invalid = await call('/api/auth/admin/login', { method: 'POST', body: { ...credentials, totpCode: invalidCode } });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.code, 'ADMIN_MFA_INVALID');

    const accepted = await call('/api/auth/admin/login', { method: 'POST', body: { ...credentials, totpCode: validCode } });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.user.role, 'admin');
    assert.ok(accepted.body.token);
  });

  test('only admins can manage products and see all orders', async () => {
    const customerToken = await register('c@test.com');
    const payload = { name: 'Beanie', price: 5000, stock: 2 };
    assert.equal((await call('/api/admin/products', { method: 'POST', body: payload })).status, 401);
    assert.equal((await call('/api/admin/products', { method: 'POST', token: customerToken, body: payload })).status, 403);
    assert.equal((await call('/api/admin/products', { method: 'POST', token: adminToken, body: payload })).status, 201);
    assert.equal((await call('/api/admin/products', { method: 'POST', token: adminToken, body: { ...payload, images: ['http://insecure.example/a.jpg'] } })).status, 400);
    assert.equal((await call('/api/admin/orders', { token: customerToken })).status, 403);
    assert.equal((await call('/api/admin/orders', { token: adminToken })).status, 200);
  });

  test('catalog: search, category filter and pagination', async () => {
    await newProduct({ name: 'Rose plush', category: 'amigurumi', price: 3000 });
    await newProduct({ name: 'Rose bag', category: 'bags', price: 9000 });
    await newProduct({ name: 'Sage beanie', category: 'wearables', price: 5000 });
    assert.equal((await call('/api/products?q=rose')).body.total, 2);
    assert.deepEqual((await call('/api/products?category=bags')).body.products.map((p) => p.name), ['Rose bag']);
    const page2 = (await call('/api/products?limit=2&page=2')).body;
    assert.equal(page2.products.length, 1);
    assert.equal(page2.pages, 2);
  });

  test('checkout holds stock, adds the delivery fee, and ignores prices sent by the browser', async () => {
    const p = await newProduct({ price: 10000, stock: 5 });
    paymobCalls.length = 0;
    const res = await checkout([{ productId: p.id, qty: 2, price: 1 }], 'sara@test.com');
    assert.equal(res.status, 200);
    assert.match(res.body.url, /unifiedcheckout\/\?publicKey=egy_pk_test_y&clientSecret=egy_csk_test_z/);
    assert.equal((await Product.findById(p.id)).stock, 3);
    const order = await Order.findOne({ email: 'sara@test.com' });
    assert.equal(order.status, 'pending');
    assert.equal(order.shippingFee, 5000);
    assert.equal(order.total, 25000);
    assert.equal(order.customer.phone, '+201112345678');
    assert.equal(paymobCalls[0].amount, 25000);
    assert.equal(paymobCalls[0].items.reduce((sum, i) => sum + i.amount, 0), 25000);
  });

  test('each Paymob retry keeps its own intention order ID', async () => {
    const p = await newProduct();
    await checkout([{ productId: p.id, qty: 1 }], 'retry-ids@test.com');
    const order = await Order.findOne({ email: 'retry-ids@test.com' });
    assert.deepEqual(order.paymobOrderIds, ['12345']);

    // Simulate a pre-deployment order with only the legacy scalar field.
    await Order.collection.updateOne({ _id: order._id }, { $unset: { paymobOrderIds: 1 } });
    assert.equal((await call(`/api/orders/pay/${order.publicToken}`, { method: 'POST' })).status, 200);
    const retried = await Order.findById(order.id);
    assert.deepEqual(retried.paymobOrderIds, ['12345', '12346']);
    assert.equal(retried.paymobOrderId, '12346');
  });

  test('pickup orders pay no delivery fee', async () => {
    const p = await newProduct({ price: 10000 });
    await checkout([{ productId: p.id, qty: 1 }], 'pickup@test.com', { method: 'pickup' });
    const order = await Order.findOne({ email: 'pickup@test.com' });
    assert.equal(order.shippingFee, 0);
    assert.equal(order.total, 10000);
  });

  test('the last item cannot be bought twice, even when buyers arrive at the same moment', async () => {
    const p = await newProduct({ stock: 1 });
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => checkout([{ productId: p.id, qty: 1 }], `racer${i}@test.com`)));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409, 409, 409, 409]);
    assert.equal((await Product.findById(p.id)).stock, 0);
    assert.equal(await Order.countDocuments(), 1);
  });

  test('reservations: only when stock cannot cover the quantity, then approve and pay', async () => {
    const token = await register('res@test.com');
    const plenty = await newProduct({ stock: 5 });
    assert.equal((await reserveAs(token, [{ productId: plenty.id, qty: 2 }])).status, 409); // buy it normally
    const oneLeft = await newProduct({ stock: 1 });
    assert.equal((await reserveAs(token, [{ productId: oneLeft.id, qty: 2 }])).status, 201); // wants 2, only 1 left

    const soldOut = await newProduct({ stock: 0 });
    const made = await reserveAs(token, [{ productId: soldOut.id, qty: 1 }]);
    assert.equal(made.status, 201);
    assert.equal(made.body.status, 'requested');
    assert.equal((await Product.findById(soldOut.id)).stock, 0); // nothing is held for a reservation

    assert.equal((await call(`/api/admin/orders/${made.body._id}/approve`, { method: 'POST', token, body: {} })).status, 403); // not the customer's call
    const approved = await call(`/api/admin/orders/${made.body._id}/approve`, { method: 'POST', token: adminToken, body: { eta: '2 weeks' } });
    assert.equal(approved.body.status, 'approved');
    paymobCalls.length = 0;
    const pay = await call(`/api/orders/pay/${approved.body.publicToken}`, { method: 'POST' });
    assert.equal(pay.status, 200);
    assert.equal(paymobCalls.length, 1);
  });

  test('a declined reservation can no longer be paid', async () => {
    const token = await register('declined@test.com');
    const soldOut = await newProduct({ stock: 0 });
    const made = await reserveAs(token, [{ productId: soldOut.id, qty: 1 }]);
    const declined = await call(`/api/admin/orders/${made.body._id}/decline`, { method: 'POST', token: adminToken, body: { reason: 'Too busy' } });
    assert.equal(declined.body.status, 'declined');
    assert.equal((await call(`/api/orders/pay/${made.body.publicToken}`, { method: 'POST' })).status, 410);
  });

  test('Paymob callback: forged, short and failed payments are ignored; a real one marks the order paid exactly once', async () => {
    const p = await newProduct({ stock: 3, price: 10000 });
    await checkout([{ productId: p.id, qty: 1 }], 'pay@test.com');
    const order = await Order.findOne({ email: 'pay@test.com' });
    const status = async () => (await Order.findById(order.id)).status;

    const forged = paymobCallback(order, { id: 1001 });
    forged.hmac = 'f'.repeat(128);
    assert.equal((await sendCallback(forged)).status, 401);
    assert.equal((await sendCallback(paymobCallback(order, { id: 1002, amount_cents: order.total - 100 }))).status, 200); // underpaid
    assert.equal((await sendCallback(paymobCallback(order, { id: 1003, success: false }))).status, 200); // declined card
    assert.equal(await status(), 'pending');

    const genuine = paymobCallback(order, { id: 1004 });
    assert.equal((await sendCallback(genuine)).status, 200);
    assert.equal((await sendCallback(genuine)).status, 200); // Paymob may deliver twice
    assert.equal(await status(), 'paid');
    assert.equal((await Product.findById(p.id)).stock, 2); // stock was not taken a second time
  });

  test('a valid callback cannot redirect a payment to a cancelled order by changing merchant_order_id', async () => {
    const p = await newProduct({ stock: 4, price: 10000 });
    await checkout([{ productId: p.id, qty: 1 }], 'source-payment@test.com');
    const sourceOrder = await Order.findOne({ email: 'source-payment@test.com' });
    const genuine = paymobCallback(sourceOrder, { id: 67890 });
    assert.equal((await sendCallback(genuine)).status, 200);
    assert.equal((await Order.findById(sourceOrder.id)).status, 'paid');

    await checkout([{ productId: p.id, qty: 1 }], 'cancelled-target@test.com');
    const targetOrder = await Order.findOne({ email: 'cancelled-target@test.com' });
    const cancelled = await call(`/api/admin/orders/${targetOrder.id}/cancel`, { method: 'PATCH', token: adminToken, body: {} });
    assert.equal(cancelled.body.status, 'cancelled');

    // merchant_order_id is not in Paymob's HMAC fields, so this is still the exact same valid signature.
    const redirected = paymobCallback(sourceOrder, {
      id: 67890,
      order: { id: sourceOrder.paymobOrderIds.at(-1), merchant_order_id: `${targetOrder.id}-1` },
    });
    assert.equal(redirected.hmac, genuine.hmac);
    assert.equal((await sendCallback(redirected)).status, 200);
    assert.equal((await Order.findById(sourceOrder.id)).status, 'paid');
    const unchangedTarget = await Order.findById(targetOrder.id);
    assert.equal(unchangedTarget.status, 'cancelled');
    assert.equal(unchangedTarget.paymentStatus, 'unpaid');
    assert.equal(unchangedTarget.paymobTransactionId, undefined);
    assert.deepEqual(refundCalls, []);
  });

  test('abandoned checkouts release their stock, and a late payment is still honoured', async () => {
    const p = await newProduct({ stock: 2, price: 10000 });
    await checkout([{ productId: p.id, qty: 2 }], 'late@test.com');
    assert.equal((await Product.findById(p.id)).stock, 0);
    const order = await Order.findOne({ email: 'late@test.com' });

    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 2 * 3600e3) } });
    await sweep();
    assert.equal((await Order.findById(order.id)).status, 'expired');
    assert.equal((await Product.findById(p.id)).stock, 2);

    assert.equal((await sendCallback(paymobCallback(order))).status, 200);
    assert.equal((await Order.findById(order.id)).status, 'paid');
    assert.equal((await Product.findById(p.id)).stock, 0);
  });

  test('Paymob inquiry errors keep an old checkout and its stock held for another check', async () => {
    const p = await newProduct({ stock: 2, price: 10000 });
    await checkout([{ productId: p.id, qty: 1 }], 'inquiry-error@test.com');
    const order = await Order.findOne({ email: 'inquiry-error@test.com' });
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 2 * 3600e3) } });
    paymobReferenceInquiryStatus = 503;

    await sweep();

    const unchanged = await Order.findById(order.id);
    assert.equal(unchanged.status, 'pending');
    assert.equal(unchanged.stockHeld, true);
    assert.ok(unchanged.paymentIssueReportedAt);
    assert.equal((await Product.findById(p.id)).stock, 1);
  });

  test('Paymob sweep keeps an old checkout open when the merchant API key is missing', async () => {
    const p = await newProduct({ stock: 2, price: 10000 });
    await checkout([{ productId: p.id, qty: 1 }], 'missing-inquiry-key@test.com');
    const order = await Order.findOne({ email: 'missing-inquiry-key@test.com' });
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - 2 * 3600e3) } });
    const originalApiKey = process.env.PAYMOB_API_KEY;
    delete process.env.PAYMOB_API_KEY;
    try {
      await sweep();
    } finally {
      if (originalApiKey === undefined) delete process.env.PAYMOB_API_KEY;
      else process.env.PAYMOB_API_KEY = originalApiKey;
    }

    const unchanged = await Order.findById(order.id);
    assert.equal(unchanged.status, 'pending');
    assert.equal(unchanged.stockHeld, true);
    assert.ok(unchanged.paymentIssueReportedAt);
    assert.equal((await Product.findById(p.id)).stock, 1);
  });

  test('admin cancellation requests one full Paymob refund and retains the cancellation reason', async () => {
    const p = await newProduct({ stock: 3, price: 10000 });
    const started = await checkout([{ productId: p.id, qty: 1 }], 'refund@test.com');
    assert.equal(started.status, 200);
    const order = await Order.findOne({ email: 'refund@test.com' });
    const paid = paymobCallback(order, { id: 24680, order: { id: order.paymobOrderIds.at(-1), merchant_order_id: `${order.id}-1` } });
    assert.equal((await sendCallback(paid)).status, 200);
    assert.equal((await Order.findById(order.id)).paymentStatus, 'paid');

    const reason = 'Customer asked to cancel';
    const cancelled = await call(`/api/admin/orders/${order.id}/cancel`, {
      method: 'PATCH', token: adminToken, body: { reason },
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(cancelled.body.paymentStatus, 'paid');
    assert.equal(cancelled.body.refundStatus, 'processing');
    assert.equal(cancelled.body.refundAmount, order.total);
    assert.equal(cancelled.body.paymobRefundTransactionId, '98765');
    assert.equal(cancelled.body.cancellationReason, reason);
    assert.deepEqual(refundCalls, [{ transaction_id: '24680', amount_cents: order.total }]);

    const repeated = await call(`/api/admin/orders/${order.id}/cancel`, { method: 'PATCH', token: adminToken, body: {} });
    assert.equal(repeated.status, 200);
    assert.equal(refundCalls.length, 1, 'repeating the cancel action must not issue a second refund');
  });

  test('the guest order page shows only the basics', async () => {
    const p = await newProduct();
    await checkout([{ productId: p.id, qty: 1 }], 'privacy@test.com');
    const order = await Order.findOne({ email: 'privacy@test.com' });
    const res = await call(`/api/orders/by-ref/${order.publicToken}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['items', 'method', 'status', 'total']);
    assert.deepEqual(res.body.items, [{ name: p.name, qty: 1 }]);
    assert.equal((await call('/api/orders/by-ref/not-a-real-token')).status, 404);
  });

  test('admins can review audit events for their changes', async () => {
    const product = await newProduct();
    const changed = await call(`/api/admin/products/${product.id}/stock`, { method: 'PATCH', token: adminToken, body: { delta: 2 } });
    assert.equal(changed.status, 200);

    let event;
    for (let attempt = 0; attempt < 20 && !event; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      event = await AdminAuditLog.findOne({ route: '/api/admin/products/:id/stock' }).lean();
    }
    assert.ok(event, 'the stock change should be recorded in the audit log');
    assert.equal(event.method, 'PATCH');
    assert.equal(event.status, 200);
    assert.ok(event.requestId);

    const auditLog = await call('/api/admin/audit-log?limit=5', { token: adminToken });
    assert.equal(auditLog.status, 200);
    assert.ok(auditLog.body.events.some((entry) => entry.route === '/api/admin/products/:id/stock'));
    assert.equal((await call('/api/admin/audit-log')).status, 401);
    const customerToken = await register('audit-customer@test.com');
    assert.equal((await call('/api/admin/audit-log', { token: customerToken })).status, 403);
  });

  test('login rate limits repeated attempts and returns a friendly response', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      responses.push(await call('/api/auth/login', {
        method: 'POST', body: { email: 'rate-limit@test.com', password: 'wrong-password' },
      }));
    }
    assert.deepEqual(responses.slice(0, 8).map((response) => response.status), Array(8).fill(401));
    assert.equal(responses[8].status, 429);
    assert.equal(responses[8].body.code, 'RATE_LIMITED');
    assert.match(responses[8].body.message, /wait a few minutes and try again/i);
  });
});
