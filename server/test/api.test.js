import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { paymobCallback } from '../testkit/paymobCallback.js';

// These run against a real MongoDB and are skipped unless MONGO_URI is set (the database name must contain "test").
const RUN = Boolean(process.env.MONGO_URI);

describe('API', { skip: !RUN && 'set MONGO_URI to a test database to run these' }, () => {
  let server, base, mongoose, Product, User, Order, sweep, adminToken, realFetch;
  const paymobCalls = [];
  let counter = 0;

  const call = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const newProduct = (over = {}) => Product.create({ name: `Piece ${++counter}`, price: 10000, stock: 5, ...over });
  const register = async (email) => (await call('/api/auth/register', { method: 'POST', body: { email, password: 'password123' } })).body.token;
  const giftDelivery = {
    method: 'delivery', gift: true, recipientName: 'Mona Ali', phone: '01012345678', giftMessage: 'Happy birthday',
    address: { line1: '1 Nile St', city: 'Cairo', country: 'Egypt' },
  };
  const checkout = (items, email = 'guest@test.com', delivery = giftDelivery, extra = {}) => call('/api/orders/checkout', {
    method: 'POST', body: { items, delivery, customer: { name: 'Sara Hassan', phone: '01112345678', email }, ...extra },
  });
  const sendCallback = ({ obj, hmac }) => call(`/api/orders/webhook?hmac=${hmac}`, { method: 'POST', body: { type: 'TRANSACTION', obj } });
  const reserveAs = (token, items) => call('/api/orders/reserve', {
    method: 'POST', token, body: { items, delivery: { method: 'pickup' }, customer: { name: 'Nour Adel', phone: '01234567890' }, note: 'Pink please' },
  });

  before(async () => {
    Object.assign(process.env, {
      JWT_SECRET: 'test-secret', CLIENT_URL: 'http://localhost:3000', API_URL: 'https://api.example.com', CURRENCY: 'EGP',
      DELIVERY_FEE: '5000', PICKUP_ADDRESS: '1 Test Street', PAYMOB_SECRET_KEY: 'egy_sk_test_x', PAYMOB_PUBLIC_KEY: 'egy_pk_test_y',
      PAYMOB_HMAC_SECRET: 'test-hmac', PAYMOB_INTEGRATION_IDS: '111',
    });
    delete process.env.SMTP_HOST;
    // Play the part of Paymob; every other request goes through for real
    realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('accept.paymob.com')) {
        paymobCalls.push(JSON.parse(opts.body));
        return { ok: true, json: async () => ({ client_secret: 'egy_csk_test_z' }) };
      }
      return realFetch(url, opts);
    };
    mongoose = (await import('mongoose')).default;
    Product = (await import('../src/models/Product.js')).default;
    User = (await import('../src/models/User.js')).default;
    Order = (await import('../src/models/Order.js')).default;
    const { app } = await import('../src/app.js');
    ({ sweep } = await import('../src/routes/orders.js'));

    await mongoose.connect(process.env.MONGO_URI);
    if (!/test/i.test(mongoose.connection.name)) {
      throw new Error(`Refusing to run against "${mongoose.connection.name}": the database name must contain "test"`);
    }
    await Promise.all([Product.init(), User.init(), Order.init()]);
    await Promise.all([Product, User, Order].map((m) => m.deleteMany({})));
    await User.create({ name: 'Admin', email: 'admin@test.com', password: 'adminpass1', role: 'admin' });

    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
    adminToken = (await call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.com', password: 'adminpass1' } })).body.token;
  });
  beforeEach(() => Promise.all([Product.deleteMany({}), Order.deleteMany({})]));
  after(async () => {
    if (realFetch) globalThis.fetch = realFetch;
    if (server) { server.close(); server.closeAllConnections?.(); }
    await mongoose?.disconnect();
  });

  test('accounts: duplicate emails are rejected and wrong passwords cannot log in', async () => {
    const body = { email: 'a@test.com', password: 'password123' };
    assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 201);
    assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 409);
    assert.ok((await call('/api/auth/login', { method: 'POST', body })).body.token);
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { ...body, password: 'wrongpass99' } })).status, 401);
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

    const forged = paymobCallback(order);
    forged.hmac = 'f'.repeat(128);
    assert.equal((await sendCallback(forged)).status, 401);
    assert.equal((await sendCallback(paymobCallback(order, { amount_cents: order.total - 100 }))).status, 200); // underpaid
    assert.equal((await sendCallback(paymobCallback(order, { success: false }))).status, 200); // declined card
    assert.equal(await status(), 'pending');

    const genuine = paymobCallback(order);
    assert.equal((await sendCallback(genuine)).status, 200);
    assert.equal((await sendCallback(genuine)).status, 200); // Paymob may deliver twice
    assert.equal(await status(), 'paid');
    assert.equal((await Product.findById(p.id)).stock, 2); // stock was not taken a second time
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
});
