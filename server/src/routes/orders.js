import { Router } from 'express';
import { z } from 'zod';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { mail } from '../email.js';
import { createCheckout, isValidHmac } from '../paymob.js';
import { feeFor, sumTotal, toEgPhone } from '../pricing.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const AWAITING_PAYMENT = ['pending', 'approved'];
const PAY_HOURS = 23; // how long an approved reservation stays payable
const itemsSchema = z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(20) })).min(1);
const deliverySchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('pickup') }), // free: collected from the business address
  z.object({
    method: z.literal('delivery'),
    gift: z.boolean().default(false), // true = sent to someone else
    recipientName: z.string().min(2).max(80),
    phone: z.string().min(6).max(30),
    address: z.object({
      line1: z.string().min(3).max(120), line2: z.string().max(120).optional(),
      city: z.string().min(2).max(80), postalCode: z.string().max(20).optional(),
      country: z.string().min(2).max(60),
    }),
    giftMessage: z.string().max(300).optional(),
  }),
]);
const customerSchema = z.object({ name: z.string().min(2).max(80), phone: z.string().min(8).max(20) });
const paymentMethodSchema = z.enum(['paymob', 'instapay', 'cod']).default('paymob');

// ---- stock helpers: in-stock items are HELD (decremented) the moment a direct checkout starts ----

async function buildLines(items) {
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
  return items.map(({ productId, qty }) => {
    const p = products.find((x) => x.id === productId);
    if (!p) throw fail(404, 'Product not found');
    return { product: p._id, name: p.name, price: p.price, qty }; // price from DB, never the client
  });
}

const restock = (lines) =>
  Promise.all(lines.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } })));

// Atomic per line: the filter `stock >= qty` and the decrement happen in one DB operation.
async function holdStock(lines) {
  const held = [];
  try {
    for (const l of lines) {
      const r = await Product.updateOne({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } });
      if (!r.modifiedCount) throw fail(409, `Not enough stock for ${l.name}: you can request a reservation instead`);
      held.push(l);
    }
  } catch (e) {
    await restock(held); // roll back partial holds
    throw e;
  }
}

// Moves an order to a closed state exactly once. Only the caller that wins the transition releases the
// stock (and only for orders that held some), so callbacks, retries and the sweeper can't double-restock.
async function closeOrder(filter, status, extra = {}) {
  const order = await Order.findOneAndUpdate(filter, { status, ...extra }, { new: true });
  if (order?.stockHeld) await restock(order.items);
  return order;
}

// Expire an order; reservations (no held stock) also tell the customer. Abandoned checkouts stay quiet.
async function expire(filter) {
  const order = await closeOrder(filter, 'expired');
  if (order && (!order.stockHeld || ['instapay', 'cod'].includes(order.paymentMethod))) mail.expired(order);
  return order;
}

// Every Paymob request carries a unique reference, so a retry never reuses an old one.
async function startPayment(order) {
  const { paymentAttempts } = await Order.findByIdAndUpdate(order._id, { $inc: { paymentAttempts: 1 } }, { new: true });
  return createCheckout(order, paymentAttempts);
}

// ---- direct checkout (guests welcome): hold stock, then send the customer to Paymob ----
router.post('/checkout', optionalAuth, async (req, res) => {
  const { items, delivery, customer, paymentMethod } = z.object({
    items: itemsSchema, delivery: deliverySchema, customer: customerSchema.extend({ email: z.string().email() }),
    paymentMethod: paymentMethodSchema,
  }).parse(req.body);
  if (paymentMethod === 'instapay' && !process.env.INSTAPAY_ADDRESS)
    throw fail(503, 'InstaPay payment details are not configured yet');
  const lines = await buildLines(items);
  await holdStock(lines);
  let order;
  try {
    order = await Order.create({
      user: req.user?.id, email: customer.email.toLowerCase(), customer: { name: customer.name, phone: toEgPhone(customer.phone) },
      items: lines, delivery, shippingFee: feeFor(delivery), total: sumTotal(lines) + feeFor(delivery), stockHeld: true,
      paymentMethod, paymentStatus: paymentMethod === 'instapay' ? 'awaiting_confirmation' : 'unpaid',
    });
    if (paymentMethod === 'paymob') return res.json({ url: await startPayment(order) });
    mail.orderPlaced(order);
    res.json({ publicToken: order.publicToken, paymentReference: String(order.id).toUpperCase() });
  } catch (e) {
    if (order) await closeOrder({ _id: order._id, status: 'pending' }, 'cancelled');
    else await restock(lines);
    throw e;
  }
});
// ---- reservation: ONLY when stock can't cover the quantity (sold out, or wants 2 and only 1 is left). ----
// Seller approves/declines, then the customer pays. Nothing is held: an approved item is made to order.
router.post('/reserve', protect, async (req, res) => {
  const { items, note, delivery, customer } = z.object({
    items: itemsSchema, note: z.string().max(500).optional(), delivery: deliverySchema, customer: customerSchema,
  }).parse(req.body);
  const lines = await buildLines(items);
  const wanted = new Map(); // total quantity per product, in case it appears on several lines
  for (const l of lines) wanted.set(String(l.product), (wanted.get(String(l.product)) ?? 0) + l.qty);
  const products = await Product.find({ _id: { $in: [...wanted.keys()] } });
  const covered = products.filter((p) => p.stock >= wanted.get(p.id));
  if (covered.length)
    throw fail(409, `${covered.map((p) => p.name).join(', ')}: enough in stock, buy it normally instead`);
  const user = await User.findById(req.user.id);
  if (!user) throw fail(401, 'Account not found');
  const order = await Order.create({
    user: user.id, email: user.email, customer: { name: customer.name, phone: toEgPhone(customer.phone) },
    items: lines, delivery, shippingFee: feeFor(delivery),
    total: sumTotal(lines) + feeFor(delivery), status: 'requested', note,
  });
  mail.requestReceived(order);
  mail.newRequest(order);
  res.status(201).json(order);
});

router.post('/:id/cancel', protect, async (req, res) => {
  const order = await closeOrder(
    { _id: req.params.id, user: req.user.id, status: { $in: ['requested', ...AWAITING_PAYMENT] } }, 'cancelled');
  if (!order) return res.status(409).json({ message: "This order can't be cancelled" });
  res.json(order);
});

// Payment links (emails, "Pay now", "Try again") point at our site and land here. A fresh Paymob checkout
// is created on demand, so the links never go stale. The token is unguessable, so guests can use it too.
router.post('/pay/:token', async (req, res) => {
  const order = await Order.findOne({ publicToken: req.params.token });
  if (!order) throw fail(404, 'Order not found');
  if (order.paymentMethod && order.paymentMethod !== 'paymob') throw fail(409, 'This order uses a different payment method');
  if (['paid', 'shipped'].includes(order.status)) throw fail(409, 'This order is already paid');
  if (!AWAITING_PAYMENT.includes(order.status)) throw fail(410, 'This order is no longer open. You are welcome to place a new one.');
  if (order.status === 'approved' && order.expiresAt < new Date()) throw fail(410, 'The payment window for this reservation has closed.');
  res.json({ url: await startPayment(order) });
});

// ---- Paymob callback: the only place an order becomes "paid" ----
export async function webhook(req, res) {
  const { type, obj } = req.body || {};
  if (!isValidHmac(obj, req.query.hmac)) return res.status(401).send('Invalid signature');
  if (type === 'TRANSACTION' && obj.success === true && obj.pending !== true && !obj.is_voided && !obj.is_refunded) {
    const orderId = String(obj.order?.merchant_order_id || '').split('-')[0]; // "<order id>-<attempt>"
    if (/^[a-f0-9]{24}$/.test(orderId)) await settle(orderId, obj.amount_cents);
  }
  res.json({ received: true });
}

async function settle(orderId, paidAmount) {
  const order = await Order.findById(orderId);
  if (!order) return;
  if (order.paymentMethod && order.paymentMethod !== 'paymob') return console.error(`Order ${orderId}: Paymob callback does not match the selected payment method`);
  if (paidAmount !== order.total) return console.error(`Order ${orderId}: paid ${paidAmount} but expected ${order.total}`);
  // Claim the order atomically so repeated callbacks can't process it twice. `prev` is the order as it was.
  const prev = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: [...AWAITING_PAYMENT, 'expired', 'cancelled'] } },
    { status: 'paid', paymentStatus: 'paid' });
  if (!prev) return;

  let short = false;
  if (['expired', 'cancelled'].includes(prev.status) && prev.stockHeld) { // paid after its stock hold was released
    for (const i of prev.items) {
      const r = await Product.updateOne({ _id: i.product, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } });
      if (!r.modifiedCount) short = true;
    }
  }
  const paid = await Order.findById(orderId);
  mail.paid(paid);
  if (short) mail.problem(paid, 'This order was paid after its stock hold expired, and some items are no longer in stock. Check availability or refund it in Paymob.');
}
// Backstop for stale orders (run every 10 min): unanswered requests, abandoned checkouts, unpaid approvals.
export async function sweep() {
  const ago = (ms) => new Date(Date.now() - ms);
  const ttl = (+process.env.REQUEST_TTL_DAYS || 3) * 864e5;
  const instaPayTtl = (+process.env.INSTAPAY_PAYMENT_TTL_HOURS || 24) * 3600e3;
  const codTtl = (+process.env.COD_ORDER_TTL_DAYS || 14) * 864e5;
  const stale = await Order.find({ $or: [
    { status: 'requested', createdAt: { $lt: ago(ttl) } },
    { status: 'pending', paymentMethod: 'paymob', createdAt: { $lt: ago(3600e3) } },
    { status: 'pending', paymentMethod: { $exists: false }, createdAt: { $lt: ago(3600e3) } },
    { status: 'pending', paymentMethod: 'instapay', createdAt: { $lt: ago(instaPayTtl) } },
    { status: 'pending', paymentMethod: 'cod', createdAt: { $lt: ago(codTtl) } },
    { status: 'approved', expiresAt: { $lt: ago(600e3) } },
  ] });
  for (const o of stale) await expire({ _id: o._id, status: o.status });
}
// Limited view for the thank-you page (guests have no account)
router.get('/by-ref/:token', async (req, res) => {
  const o = await Order.findOne({ publicToken: req.params.token });
  if (!o) return res.status(404).json({ message: 'Order not found' });
  res.json({
    status: o.status, total: o.total, method: o.delivery?.method,
    paymentMethod: o.paymentMethod || 'paymob', paymentStatus: o.paymentStatus || 'unpaid',
    paymentReference: String(o.id).toUpperCase(), instaPayReference: o.instaPayReference || '',
    items: o.items.map(({ name, qty }) => ({ name, qty })),
  });
});

router.post('/by-ref/:token/instapay-reference', async (req, res) => {
  const { reference } = z.object({ reference: z.string().trim().min(3).max(80) }).parse(req.body);
  const order = await Order.findOneAndUpdate(
    { publicToken: req.params.token, status: 'pending', paymentMethod: 'instapay' },
    { instaPayReference: reference }, { new: true });
  if (!order) throw fail(409, 'This InstaPay order is no longer awaiting confirmation');
  mail.instapayReferenceSubmitted(order);
  res.json({ saved: true });
});
router.get('/mine', protect, async (req, res) => {
  res.json(await Order.find({ user: req.user.id }).sort('-createdAt'));
});

export default router;
