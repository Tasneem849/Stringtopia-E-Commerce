import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import PromoCode from '../models/PromoCode.js';
import User from '../models/User.js';
import { mail } from '../email.js';
import { createCheckout, inquireTransactionByReference, isValidHmac } from '../paymob.js';
import { requestPaymobRefund, recordPaymobRefund, reconcilePaymobRefund } from '../refunds.js';
import { feeFor, sumTotal, toEgPhone } from '../pricing.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const AWAITING_PAYMENT = ['pending', 'approved'];
const PAY_HOURS = 23; // how long an approved reservation stays payable
const CANCEL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const promoValidationLimit = rateLimit({ windowMs: 10 * 60e3, max: 20 });
const checkoutLimit = rateLimit({ windowMs: 10 * 60e3, max: 12 });
const paymobRetryLimit = rateLimit({
  windowMs: 15 * 60e3,
  max: 6,
  keyGenerator: (req) => [`paymob-retry-ip:${req.ip || 'unknown'}`, `paymob-retry-order:${req.params.token || 'unknown'}`],
});
const reconciliationLimit = rateLimit({
  windowMs: 15 * 60e3,
  max: 3,
  keyGenerator: (req) => [`reconcile-ip:${req.ip || 'unknown'}`, `reconcile-order:${req.params.token || 'unknown'}`],
});
const promoCodeSchema = z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/);
const itemsSchema = z.array(z.object({
  productId: z.string(), qty: z.number().int().min(1).max(20), variant: z.string().trim().min(1).max(80).optional(),
})).min(1).max(30);
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
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }).select('+unitCost');
  return items.map(({ productId, qty, variant }) => {
    const p = products.find((x) => x.id === productId);
    if (!p) throw fail(404, 'Product not found');
    const choices = p.variants || [];
    if (choices.length && !variant) throw fail(400, `Choose a ${p.variantLabel || 'variant'} for ${p.name}.`);
    if (variant && !choices.includes(variant)) throw fail(400, `That ${p.variantLabel || 'variant'} is not available for ${p.name}.`);
    const price = Number.isFinite(p.salePrice) && p.salePrice >= 0 && p.salePrice < p.price ? p.salePrice : p.price;
    return {
      product: p._id, name: p.name,
      ...(variant ? { variantLabel: p.variantLabel || 'Option', variant } : {}),
      price, ...(Number.isFinite(p.unitCost) ? { unitCost: p.unitCost } : {}), qty,
    }; // snapshots from DB, never the client
  });
}

async function resolvePromo(code, subtotal) {
  const normalizedCode = code.trim().toUpperCase();
  const promo = await PromoCode.findOne({ code: normalizedCode, active: true }).lean();
  if (!promo) throw fail(400, 'That promo code is invalid or inactive.');
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) throw fail(400, 'That promo code is not active yet.');
  if (promo.expiresAt && promo.expiresAt <= now) throw fail(400, 'That promo code has expired.');
  if (subtotal < (promo.minimumOrder || 0)) throw fail(400, 'Your items do not meet the minimum order for that promo code.');
  if (promo.usageLimit != null && promo.redemptionCount >= promo.usageLimit) throw fail(400, 'That promo code has reached its usage limit.');
  const discountAmount = promo.discountType === 'percentage'
    ? Math.min(subtotal, Math.round(subtotal * promo.discountValue / 100))
    : Math.min(subtotal, promo.discountValue);
  return { code: promo.code, discountAmount, subtotal };
}

async function claimPromo(code, subtotal) {
  const now = new Date();
  const promo = await PromoCode.findOneAndUpdate({
    code,
    active: true,
    minimumOrder: { $lte: subtotal },
    $and: [
      { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ['$redemptionCount', '$usageLimit'] } }] },
    ],
  }, { $inc: { redemptionCount: 1 } }, { new: true });
  if (!promo) throw fail(409, 'That promo code is no longer available. Please review your total and try again.');
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
  const previous = await Order.findOneAndUpdate(filter, { status, promoUseHeld: false, ...extra }, { new: false });
  if (!previous) return null;
  const closed = { ...previous.toObject(), status, promoUseHeld: false, ...extra };
  if (closed.stockHeld) await restock(closed.items);
  if (previous.promoUseHeld && previous.promoCode) {
    await PromoCode.updateOne({ code: previous.promoCode, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
  }
  return closed;
}

// Expire an order; reservations (no held stock) also tell the customer. Abandoned checkouts stay quiet.
async function expire(filter) {
  const order = await closeOrder(filter, 'expired');
  if (order && (!order.stockHeld || ['instapay', 'cod'].includes(order.paymentMethod))) mail.expired(order);
  return order;
}

// Every Paymob request carries a unique reference, so a retry never reuses an old one.
async function startPayment(order) {
  const updated = await Order.findByIdAndUpdate(order._id, { $inc: { paymentAttempts: 1 } }, { new: true });
  if (!updated || updated.paymentAttempts > 6) throw fail(429, 'Too many payment attempts. Please contact Stringtopia for help.');
  const specialReference = `${order.id}-${updated.paymentAttempts}`;
  await Order.updateOne({ _id: order._id }, { paymobReference: specialReference });
  const checkout = await createCheckout(order, updated.paymentAttempts);
  if (checkout.paymobOrderId) await Order.updateOne({ _id: order._id }, { paymobOrderId: String(checkout.paymobOrderId) });
  return checkout.url;
}

router.post('/promo/validate', promoValidationLimit, async (req, res) => {
  const { code, items } = z.object({ code: promoCodeSchema, items: itemsSchema }).parse(req.body);
  const lines = await buildLines(items);
  const promo = await resolvePromo(code, sumTotal(lines));
  res.json(promo);
});

// ---- direct checkout (guests welcome): hold stock, then send the customer to Paymob ----
router.post('/checkout', checkoutLimit, optionalAuth, async (req, res) => {
  const { items, delivery, customer, paymentMethod, promoCode } = z.object({
    items: itemsSchema, delivery: deliverySchema, customer: customerSchema.extend({ email: z.string().email() }),
    paymentMethod: paymentMethodSchema, promoCode: promoCodeSchema.optional(),
  }).parse(req.body);
  if (paymentMethod === 'instapay' && !process.env.INSTAPAY_ADDRESS)
    throw fail(503, 'InstaPay payment details are not configured yet');
  const email = customer.email.trim().toLowerCase();
  const phone = toEgPhone(customer.phone);
  const checkoutIpHash = crypto.createHmac('sha256', process.env.CHECKOUT_IP_HASH_SECRET || process.env.JWT_SECRET)
    .update(req.ip || 'unknown').digest('hex');

  // A returning customer who retries Paymob should not lose stock to their abandoned first attempt.
  const abandonedPaymob = await Order.find({
    status: 'pending', paymentMethod: 'paymob', stockHeld: true,
    $or: [{ email }, { 'customer.phone': phone }],
  }).select('_id');
  for (const abandoned of abandonedPaymob) {
    await closeOrder({ _id: abandoned._id, status: 'pending' }, 'cancelled');
  }

  const emailOpen = await Order.countDocuments({ email, status: 'pending', stockHeld: true });
  const phoneOpen = await Order.countDocuments({ 'customer.phone': phone, status: 'pending', stockHeld: true });
  const ipOpen = await Order.countDocuments({ checkoutIpHash, status: 'pending', stockHeld: true });
  if (emailOpen >= 3 || phoneOpen >= 3 || ipOpen >= 5)
    throw fail(429, 'You have several open orders already. Complete or cancel one before placing another.');
  const lines = await buildLines(items);
  const subtotal = sumTotal(lines);
  const promo = promoCode ? await resolvePromo(promoCode, subtotal) : null;
  const discountAmount = promo?.discountAmount || 0;
  const shippingFee = feeFor(delivery);
  const total = subtotal - discountAmount + shippingFee;
  if (total <= 0) throw fail(400, 'A promo code cannot reduce the order total to zero.');
  await holdStock(lines);
  let order;
  let promoClaimed = false;
  try {
    if (promo) {
      await claimPromo(promo.code, subtotal);
      promoClaimed = true;
    }
    order = await Order.create({
      user: req.user?.id, email, customer: { name: customer.name, phone }, checkoutIpHash: checkoutIpHash || undefined,
      items: lines, delivery, shippingFee, promoCode: promo?.code, discountAmount, promoUseHeld: Boolean(promo),
      total, stockHeld: true,
      paymentMethod, paymentStatus: paymentMethod === 'instapay' ? 'awaiting_confirmation' : 'unpaid',
    });
    if (paymentMethod === 'paymob') return res.json({ url: await startPayment(order) });
    mail.orderPlaced(order);
    res.json({ publicToken: order.publicToken, paymentReference: String(order.id).toUpperCase() });
  } catch (e) {
    if (order) await closeOrder({ _id: order._id, status: 'pending' }, 'cancelled');
    else {
      await restock(lines);
      if (promoClaimed) await PromoCode.updateOne({ code: promo.code, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
    }
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
  res.status(201).json({
    ...order.toObject(),
    items: order.items.map(({ product, name, price, qty, variantLabel, variant }) => ({ product, name, price, qty, variantLabel, variant })),
  });
});

router.post('/:id/cancel', protect, async (req, res) => {
  const cutoff = new Date(Date.now() - CANCEL_WINDOW_MS);
  const order = await closeOrder({
    _id: req.params.id,
    user: req.user.id,
    status: { $in: ['requested', ...AWAITING_PAYMENT] },
    createdAt: { $gt: cutoff },
  }, 'cancelled');
  if (!order) return res.status(409).json({
    message: "This order can't be cancelled. Cancellation is only available for eligible orders within 3 days of placing them.",
  });
  res.json(order);
});

// Payment links (emails, "Pay now", "Try again") point at our site and land here. A fresh Paymob checkout
// is created on demand, so the links never go stale. The token is unguessable, so guests can use it too.
router.post('/pay/:token', paymobRetryLimit, async (req, res) => {
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
  if (type === 'TRANSACTION' && (obj.is_refunded === true || obj.is_refund === true)) {
    const transactionIds = [obj.parent_transaction, obj.id].filter((id) => id != null).map(String);
    const order = await Order.findOne({ status: 'cancelled', paymentMethod: 'paymob', paymobTransactionId: { $in: transactionIds } });
    const updated = await recordPaymobRefund(order, obj);
    if (updated) mail.refunded(updated);
  } else if (type === 'TRANSACTION' && obj.success === true && obj.pending !== true && !obj.is_voided && !obj.is_refunded) {
    const orderId = String(obj.order?.merchant_order_id || '').split('-')[0]; // "<order id>-<attempt>"
    const transactionId = obj.id == null ? undefined : String(obj.id);
    const paymobOrderId = obj.order?.id == null ? undefined : String(obj.order.id);
    if (/^[a-f0-9]{24}$/.test(orderId)) await settle(orderId, obj.amount_cents, transactionId, paymobOrderId);
    else if (paymobOrderId) {
      const order = await Order.findOne({ paymobOrderId });
      if (order) await settle(order.id, obj.amount_cents, transactionId, paymobOrderId);
    }
  }
  res.json({ received: true });
}

async function settle(orderId, paidAmount, transactionId, paymobOrderId) {
  const order = await Order.findById(orderId);
  if (!order) return;
  if (order.paymentMethod && order.paymentMethod !== 'paymob') {
    return reportPaymentIssue(order, `Paymob sent a successful transaction (${transactionId || 'unknown transaction'}) for an order marked ${order.paymentMethod}. Verify the payment and resolve the order manually.`);
  }

  // Cancellation wins over a late payment callback. Record the actual charge and send a full
  // refund request instead of resurrecting a cancelled order as paid.
  if (order.status === 'cancelled') {
    const amount = Number(paidAmount);
    if (!transactionId || !Number.isSafeInteger(amount) || amount <= 0) {
      return reportPaymentIssue(order, 'Paymob confirmed payment after this order was cancelled, but the transaction details were incomplete. Verify the full charge and refund it in Paymob.');
    }
    const allowedRefundStatuses = ['not_required', 'manual_required'];
    if (order.refundStatus === 'failed' && order.paymobTransactionId !== String(transactionId)) allowedRefundStatuses.push('failed');
    const cancelledPayment = await Order.findOneAndUpdate({
      _id: orderId,
      status: 'cancelled',
      paymentMethod: 'paymob',
      $or: [
        { refundStatus: { $in: allowedRefundStatuses } },
        { refundStatus: { $exists: false } },
      ],
    }, {
      $set: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        paymobTransactionId: String(transactionId),
        ...(paymobOrderId ? { paymobOrderId: String(paymobOrderId) } : {}),
        refundStatus: 'not_required',
        refundAmount: amount,
      },
    }, { new: true });
    if (!cancelledPayment) return;
    const refund = await requestPaymobRefund(cancelledPayment._id, transactionId, amount);
    if (refund?.refundStatus === 'failed') {
      mail.problem(refund, `A full refund is due for this late Paymob payment, but the automatic refund request failed: ${refund.refundError || 'Paymob rejected the request.'}`);
      mail.refundFailed(refund);
    } else if (refund?.refundStatus === 'processing') {
      mail.latePaymentRefund(refund);
    }
    return;
  }

  if (paidAmount !== order.total) {
    return reportPaymentIssue(order, `Paymob transaction ${transactionId || 'unknown'} reports ${paidAmount} piasters, but this order total is ${order.total} piasters. Verify it in Paymob before fulfillment.`);
  }
  // Claim the order atomically so repeated callbacks can't process it twice. `prev` is the order as it was.
  const prev = await Order.findOneAndUpdate(
    { _id: orderId, status: { $in: [...AWAITING_PAYMENT, 'expired'] } },
    { status: 'paid', paymentStatus: 'paid', paidAt: new Date(), paymobTransactionId: transactionId, paymobOrderId: paymobOrderId || order.paymobOrderId, promoUseHeld: false });
  if (!prev) {
    const current = await Order.findById(orderId);
    if (current?.status === 'cancelled') return settle(orderId, paidAmount, transactionId, paymobOrderId);
    return;
  }

  if (prev.promoCode && !prev.promoUseHeld && ['expired', 'cancelled'].includes(prev.status)) {
    await PromoCode.updateOne({ code: prev.promoCode }, { $inc: { redemptionCount: 1 } });
    await mail.problem(order, 'A Paymob payment was confirmed after its promo reservation had been released. Check that the promo usage limit has not been exceeded.');
  }

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
  const codTtl = (+process.env.COD_ORDER_TTL_DAYS || 3) * 864e5;
  const stale = await Order.find({
    $and: [
      { $or: [
        { status: 'requested', createdAt: { $lt: ago(ttl) } },
        { status: 'pending', paymentMethod: 'paymob', createdAt: { $lt: ago(3600e3) } },
        { status: 'pending', paymentMethod: { $exists: false }, createdAt: { $lt: ago(3600e3) } },
        { status: 'pending', paymentMethod: 'instapay', createdAt: { $lt: ago(instaPayTtl) } },
        { status: 'pending', paymentMethod: 'cod', createdAt: { $lt: ago(codTtl) } },
        { status: 'approved', expiresAt: { $lt: ago(600e3) } },
      ] },
      { $or: [
        { paymentMethod: { $ne: 'paymob' } },
        { status: { $ne: 'pending' } },
        { paymentReconciliationCheckedAt: { $exists: false } },
        { paymentReconciliationCheckedAt: { $lt: ago(30 * 60e3) } },
      ] },
    ],
  });
  for (const o of stale) {
    if (o.paymentMethod === 'paymob' && AWAITING_PAYMENT.includes(o.status)) {
      const checkedAt = new Date();
      const checkFilter = { _id: o._id, status: o.status, ...(o.paymentReconciliationCheckedAt ? { paymentReconciliationCheckedAt: o.paymentReconciliationCheckedAt } : { paymentReconciliationCheckedAt: { $exists: false } }) };
      const claimed = await Order.findOneAndUpdate(checkFilter, { paymentReconciliationCheckedAt: checkedAt });
      if (!claimed) continue;
      try {
        if (!o.paymentAttempts) {
          await reportPaymentIssue(o, 'This Paymob order has no saved payment reference. Confirm its status in the Paymob dashboard before releasing stock.');
          continue;
        }
        const transaction = await reconcilePaymob(o);
        if (!transaction) {
          await reportPaymentIssue(o, 'Paymob transaction inquiry could not verify this payment. The order is still open and stock remains held; check it in Paymob.');
          continue;
        }
        if (transaction.pending === true) {
          continue;
        }
      } catch (error) {
        console.error('Paymob reconciliation failed:', error.message);
        await reportPaymentIssue(o, 'Paymob could not confirm this payment status. The order remains open and its stock is held; check the Paymob dashboard.');
        continue;
      }
    }
    await expire({ _id: o._id, status: o.status });
  }

  if (process.env.PAYMOB_API_KEY) {
    const pendingRefunds = await Order.find({
      status: 'cancelled', paymentMethod: 'paymob', refundStatus: 'processing',
      paymobTransactionId: { $exists: true }, refundRequestedAt: { $lt: ago(60 * 1000) },
      $or: [
        { refundReconciliationCheckedAt: { $exists: false } },
        { refundReconciliationCheckedAt: { $lt: ago(10 * 60 * 1000) } },
      ],
    }).sort('refundRequestedAt').limit(20);
    for (const order of pendingRefunds) {
      const checkedAt = new Date();
      const checkFilter = {
        _id: order._id,
        refundStatus: 'processing',
        ...(order.refundReconciliationCheckedAt
          ? { refundReconciliationCheckedAt: order.refundReconciliationCheckedAt }
          : { refundReconciliationCheckedAt: { $exists: false } }),
      };
      const claimed = await Order.findOneAndUpdate(checkFilter, { refundReconciliationCheckedAt: checkedAt }, { new: true });
      if (!claimed) continue;
      try {
        const refunded = await reconcilePaymobRefund(claimed);
        if (refunded) mail.refunded(refunded);
      } catch (error) {
        console.error(`Paymob refund reconciliation failed for order ${order.id}:`, error.message);
      }
    }
  }
}

async function reportPaymentIssue(order, message) {
  const firstReport = await Order.findOneAndUpdate(
    { _id: order._id, paymentIssueReportedAt: { $exists: false } },
    { paymentIssueReportedAt: new Date() },
  );
  if (firstReport) await mail.problem(order, message);
}

async function reconcilePaymob(order) {
  const attempts = Math.max(1, Math.min(Number(order.paymentAttempts) || 1, 6));
  let latest = null;
  let pending = null;
  for (let attempt = attempts; attempt >= 1; attempt--) {
    const transaction = await inquireTransactionByReference(`${order.id}-${attempt}`);
    if (!transaction) continue;
    latest ||= transaction;
    if (transaction.pending === true) pending ||= transaction;
    if (transaction.success === true && transaction.pending !== true && !transaction.is_voided && !transaction.is_refunded) {
      await settle(order.id, transaction.amount_cents, String(transaction.id), transaction.order?.id == null ? undefined : String(transaction.order.id));
      return transaction;
    }
  }
  return pending || latest;
}

router.post('/by-ref/:token/reconcile', reconciliationLimit, async (req, res) => {
  const order = await Order.findOne({ publicToken: req.params.token });
  if (!order) throw fail(404, 'Order not found');
  if (order.paymentMethod === 'paymob' && AWAITING_PAYMENT.includes(order.status)) {
    try {
      await reconcilePaymob(order);
    } catch (error) {
      console.error('Paymob customer reconciliation failed:', error.message);
      await reportPaymentIssue(order, 'A customer asked to verify payment, but Paymob status could not be confirmed. The order remains open and stock is still held.');
    }
  }
  const current = await Order.findById(order._id);
  res.json({ status: current.status, paymentStatus: current.paymentStatus, paymentMethod: current.paymentMethod, verified: current.paymentStatus === 'paid' });
});
// Limited view for the thank-you page (guests have no account)
router.get('/by-ref/:token', async (req, res) => {
  const o = await Order.findOne({ publicToken: req.params.token });
  if (!o) return res.status(404).json({ message: 'Order not found' });
  res.json({
    status: o.status, total: o.total, method: o.delivery?.method,
    promoCode: o.promoCode || '', discountAmount: o.discountAmount || 0,
    paymentMethod: o.paymentMethod || 'paymob', paymentStatus: o.paymentStatus || 'unpaid',
    paymentReference: String(o.id).toUpperCase(), instaPayReference: o.instaPayReference || '',
    items: o.items.map(({ name, qty, variantLabel, variant }) => ({ name, qty, variantLabel, variant })),
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
