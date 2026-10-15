import { Router } from 'express';
import { z } from 'zod';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import PromoCode from '../models/PromoCode.js';
import Product from '../models/Product.js';
import SiteSettings from '../models/SiteSettings.js';
import Expense from '../models/Expense.js';
import { mail } from '../email.js';
import { requestPaymobRefund } from '../refunds.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { categoryKey, syncCategoriesFromProducts } from '../categoryCatalog.js';
import { listProducts, productSchema } from './products.js';
import uploadRoutes from './uploads.js';

const router = Router();
const PAY_HOURS = 23;
const categoryInputSchema = z.object({ name: z.string().trim().min(2).max(40) });
const manualOrderSchema = z.object({
  source: z.enum(['whatsapp', 'phone']),
  customer: z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(6).max(30) }),
  email: z.string().trim().email().optional(),
  items: z.array(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i), qty: z.number().int().min(1).max(1000) })).min(1).max(40),
  delivery: z.discriminatedUnion('method', [
    z.object({ method: z.literal('pickup') }),
    z.object({
      method: z.literal('delivery'),
      address: z.object({
        line1: z.string().trim().min(3).max(120), line2: z.string().trim().max(120).optional(),
        city: z.string().trim().min(2).max(80), postalCode: z.string().trim().max(20).optional(),
        country: z.string().trim().min(2).max(60),
      }),
    }),
  ]),
  paymentMethod: z.enum(['cash', 'instapay', 'cod']),
  paymentReceived: z.boolean().default(false),
  instaPayReference: z.string().trim().max(80).optional(),
  shippingFee: z.number().int().min(0).max(100000000).default(0),
  discountAmount: z.number().int().min(0).max(100000000).default(0),
  note: z.string().trim().max(500).optional(),
});
const expenseInputSchema = z.object({
  description: z.string().trim().min(2).max(160),
  category: z.enum(['materials', 'packaging', 'shipping', 'marketing', 'tools', 'other']),
  amount: z.number().int().min(1).max(1000000000),
  date: z.coerce.date(),
});
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeProductName = (name) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const productNamePattern = (name) => {
  const words = name.trim().replace(/\s+/g, ' ').split(' ').map(escapeRegExp);
  return new RegExp(`^\\s*${words.join('\\s+')}\\s*$`, 'i');
};
const duplicateProductMessage = (product) => `A product named "${product.name}" already exists. Edit the existing product instead.`;
const cloudinaryAudioUrl = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/video/upload/');
}, 'Use a secure Cloudinary audio upload URL');

const promoCodeInputSchema = z.discriminatedUnion('discountType', [
  z.object({
    code: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/),
    discountType: z.literal('percentage'),
    discountValue: z.number().int().min(1).max(100),
    active: z.boolean().default(true),
    startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(),
    minimumOrder: z.number().int().min(0).default(0), usageLimit: z.number().int().min(1).optional(),
  }),
  z.object({
    code: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/),
    discountType: z.literal('fixed'),
    discountValue: z.number().int().min(1).max(100000000),
    active: z.boolean().default(true),
    startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(),
    minimumOrder: z.number().int().min(0).default(0), usageLimit: z.number().int().min(1).optional(),
  }),
]);

// Every endpoint in this namespace requires a valid admin session.
router.use(protect, adminOnly);

router.get('/orders', async (req, res) => {
  const filter = req.query.status ? { status: String(req.query.status) } : {};
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const requestedPage = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const total = await Order.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pages);
  const orders = await Order.find(filter).populate('user', 'name email').sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ orders, page, pages, total });
});

router.post('/orders', async (req, res) => {
  const input = manualOrderSchema.parse(req.body ?? {});
  const quantities = new Map();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.qty);
  const productIds = [...quantities.keys()];
  const products = await Product.find({ _id: { $in: productIds } }).select('+unitCost');
  const byId = new Map(products.map((product) => [product.id, product]));
  if (byId.size !== productIds.length) return res.status(404).json({ message: 'One or more products could not be found.' });

  const lines = productIds.map((productId) => {
    const product = byId.get(productId);
    const qty = quantities.get(productId);
    const price = Number.isFinite(product.salePrice) && product.salePrice >= 0 && product.salePrice < product.price ? product.salePrice : product.price;
    return { product: product._id, name: product.name, price, ...(Number.isFinite(product.unitCost) ? { unitCost: product.unitCost } : {}), qty };
  });
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (input.discountAmount > subtotal) return res.status(400).json({ message: 'Discount cannot be greater than the products subtotal.' });
  if (input.paymentReceived && input.paymentMethod === 'instapay' && !input.instaPayReference)
    return res.status(400).json({ message: 'Add the InstaPay transfer reference before marking this payment as received.' });
  const shippingFee = input.delivery.method === 'delivery' ? input.shippingFee : 0;
  const total = subtotal - input.discountAmount + shippingFee;
  const delivery = input.delivery.method === 'pickup'
    ? { method: 'pickup' }
    : { method: 'delivery', gift: false, recipientName: input.customer.name, phone: input.customer.phone, address: input.delivery.address };

  const held = [];
  try {
    for (const line of lines) {
      const result = await Product.updateOne({ _id: line.product, stock: { $gte: line.qty } }, { $inc: { stock: -line.qty } });
      if (!result.modifiedCount) {
        const error = new Error(`Not enough stock for ${line.name}. Adjust stock or remove it from this order.`);
        error.status = 409;
        throw error;
      }
      held.push(line);
    }
    const paymentStatus = input.paymentReceived ? 'paid' : input.paymentMethod === 'instapay' ? 'awaiting_confirmation' : 'unpaid';
    const order = await Order.create({
      orderSource: input.source,
      customer: input.customer,
      ...(input.email ? { email: input.email.toLowerCase() } : {}),
      items: lines,
      delivery,
      shippingFee,
      discountAmount: input.discountAmount,
      total,
      status: input.paymentReceived ? 'paid' : 'pending',
      paymentMethod: input.paymentMethod,
      paymentStatus,
      ...(input.paymentReceived ? { paidAt: new Date() } : {}),
      ...(input.instaPayReference ? { instaPayReference: input.instaPayReference } : {}),
      ...(input.note ? { note: input.note } : {}),
      stockHeld: true,
    });
    return res.status(201).json(order);
  } catch (error) {
    if (held.length) await Promise.all(held.map((line) => Product.updateOne({ _id: line.product }, { $inc: { stock: line.qty } })));
    throw error;
  }
});

router.get('/finance', async (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ message: 'Choose a valid month.' });
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const paidOrdersQuery = {
    paymentStatus: 'paid',
    status: { $nin: ['cancelled', 'declined'] },
    $or: [
      { paidAt: { $gte: start, $lt: end } },
      { paidAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
    ],
  };
  const [orders, expenses] = await Promise.all([
    Order.find(paidOrdersQuery).select('+items.unitCost').lean(),
    Expense.find({ date: { $gte: start, $lt: end } }).sort({ date: -1, createdAt: -1 }).lean(),
  ]);

  let paidProductRevenue = 0;
  let shippingCollected = 0;
  let trackedProductRevenue = 0;
  let trackedProductCosts = 0;
  let costCompleteOrders = 0;
  let uncostedOrders = 0;
  let uncostedItems = 0;
  for (const order of orders) {
    const rawRevenue = order.items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
    const revenue = Math.max(0, rawRevenue - (order.discountAmount || 0));
    paidProductRevenue += revenue;
    shippingCollected += order.shippingFee || 0;
    const missingItems = order.items.filter((item) => !Number.isFinite(item.unitCost));
    if (missingItems.length) {
      uncostedOrders += 1;
      uncostedItems += missingItems.reduce((sum, item) => sum + (item.qty || 0), 0);
      continue;
    }
    costCompleteOrders += 1;
    trackedProductRevenue += revenue;
    trackedProductCosts += order.items.reduce((sum, item) => sum + item.unitCost * item.qty, 0);
  }
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  res.json({
    month,
    summary: {
      paidOrderCount: orders.length,
      paidProductRevenue,
      shippingCollected,
      costCompleteOrders,
      trackedProductRevenue,
      trackedProductCosts,
      trackedGrossProfit: trackedProductRevenue - trackedProductCosts,
      expenseTotal,
      trackedNetProfit: trackedProductRevenue - trackedProductCosts + shippingCollected - expenseTotal,
      uncostedOrders,
      uncostedItems,
    },
    expenses,
  });
});

router.post('/finance/expenses', async (req, res) => {
  const input = expenseInputSchema.parse(req.body ?? {});
  res.status(201).json(await Expense.create(input));
});

router.delete('/finance/expenses/:id', async (req, res) => {
  const result = await Expense.findByIdAndDelete(req.params.id);
  if (!result) return res.status(404).json({ message: 'Expense not found.' });
  res.status(204).end();
});

router.post('/orders/:id/approve', async (req, res) => {
  const { eta } = z.object({ eta: z.string().max(100).optional() }).parse(req.body ?? {});
  const expiresAt = new Date(Date.now() + PAY_HOURS * 3600e3);
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'requested' }, { status: 'approved', expiresAt, eta }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'Request is no longer open' });
  mail.approved(order);
  res.json(order);
});

router.post('/orders/:id/decline', async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'requested' }, { status: 'declined', declineReason: reason }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'Request is no longer open' });
  mail.declined(order);
  res.json(order);
});

router.patch('/orders/:id/cancel', async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  let previous = null;
  let cancelled = null;
  let madeCancellation = false;

  // Re-read and compare status/paymentStatus so a concurrent successful Paymob callback can't
  // slip between the admin's view and cancellation.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await Order.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Order not found.' });
    if (current.status === 'cancelled') {
      if (current.refundStatus === 'failed' && current.paymentMethod === 'paymob' && current.paymentStatus === 'paid' && current.paymobTransactionId) {
        cancelled = await requestPaymobRefund(current._id, current.paymobTransactionId, current.refundAmount || current.total);
        if (cancelled.refundStatus === 'failed') {
          mail.problem(cancelled, `The full Paymob refund could not be started: ${cancelled.refundError || 'Paymob rejected the request.'}`);
          mail.refundFailed(cancelled);
        } else if (cancelled.refundStatus === 'processing') {
          mail.refundSubmitted(cancelled);
        }
        return res.json(cancelled);
      }
      return res.json(current);
    }

    const paid = current.paymentStatus === 'paid';
    const needsManualPaymentReview = paid || (current.paymentMethod === 'instapay' && Boolean(current.instaPayReference));
    const canRefundAutomatically = paid && current.paymentMethod === 'paymob' && Boolean(current.paymobTransactionId);
    const refundStatus = needsManualPaymentReview ? (canRefundAutomatically ? 'not_required' : 'manual_required') : 'not_required';
    previous = await Order.findOneAndUpdate({
      _id: current._id,
      status: current.status,
      paymentStatus: current.paymentStatus,
    }, {
      $set: {
        status: 'cancelled',
        promoUseHeld: false,
        stockHeld: false,
        refundStatus,
        ...(needsManualPaymentReview ? { refundAmount: current.total } : {}),
        ...(reason ? { cancellationReason: reason } : {}),
        cancelledAt: new Date(),
      },
    }, { new: false });
    if (previous) {
      madeCancellation = true;
      break;
    }
  }

  if (!previous) return res.status(409).json({ message: 'The order changed while it was being cancelled. Refresh and try again.' });

  // Held stock may be restored only before an order has left for delivery or been marked shipped.
  if (previous.stockHeld && !['shipped', 'out_for_delivery'].includes(previous.status)) {
    await Promise.all(previous.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } })));
  }
  if (previous.promoUseHeld && previous.promoCode) {
    await PromoCode.updateOne({ code: previous.promoCode, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
  }

  cancelled = await Order.findById(previous._id);
  if (cancelled.paymentStatus === 'paid' && cancelled.paymentMethod === 'paymob' && cancelled.paymobTransactionId) {
    cancelled = await requestPaymobRefund(cancelled._id, cancelled.paymobTransactionId, cancelled.total);
    if (cancelled.refundStatus === 'failed') mail.problem(cancelled, `The full Paymob refund could not be started: ${cancelled.refundError || 'Paymob rejected the request.'}`);
  }
  if (madeCancellation) mail.cancelled(cancelled);
  res.json(cancelled);
});

router.patch('/orders/:id/confirm-payment', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'instapay', paymentStatus: 'awaiting_confirmation' },
    { status: 'paid', paymentStatus: 'paid', paidAt: new Date(), promoUseHeld: false }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This InstaPay order is no longer awaiting confirmation' });
  mail.paid(order);
  res.json(order);
});

router.patch('/orders/:id/complete-cod', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ['pending', 'out_for_delivery'] }, paymentMethod: 'cod', paymentStatus: 'unpaid' },
    { status: 'shipped', paymentStatus: 'paid', paidAt: new Date(), promoUseHeld: false }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This cash-on-delivery order is no longer open' });
  mail.codCompleted(order);
  res.json(order);
});

router.patch('/orders/:id/receive-cash', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'cash', paymentStatus: 'unpaid' },
    { status: 'paid', paymentStatus: 'paid', paidAt: new Date(), promoUseHeld: false }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This order is no longer awaiting a cash payment.' });
  res.json(order);
});

router.patch('/orders/:id/out-for-delivery', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'cod', 'delivery.method': 'delivery' },
    { status: 'out_for_delivery' }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This delivery order is no longer awaiting dispatch.' });
  mail.outForDelivery(order);
  res.json(order);
});

router.patch('/orders/:id/ship', async (req, res) => {
  const order = await Order.findOneAndUpdate({ _id: req.params.id, status: 'paid' }, { status: 'shipped' }, { new: true });
  if (!order) return res.status(409).json({ message: 'Only paid orders can be shipped' });
  mail.shipped(order);
  res.json(order);
});

router.get('/settings', async (req, res) => {
  const settings = await SiteSettings.findById('global').select('backgroundAudioUrl').lean();
  res.json({ backgroundAudioUrl: settings?.backgroundAudioUrl || '' });
});

router.put('/settings/audio', async (req, res) => {
  const { url } = z.object({ url: cloudinaryAudioUrl }).parse(req.body);
  const settings = await SiteSettings.findByIdAndUpdate(
    'global',
    { backgroundAudioUrl: url },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json({ backgroundAudioUrl: settings.backgroundAudioUrl });
});

router.delete('/settings/audio', async (req, res) => {
  const settings = await SiteSettings.findByIdAndUpdate(
    'global',
    { backgroundAudioUrl: '' },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ backgroundAudioUrl: settings.backgroundAudioUrl });
});

router.get('/promo-codes', async (req, res) => {
  res.json(await PromoCode.find().sort('-createdAt'));
});

router.get('/categories', async (req, res) => {
  await syncCategoriesFromProducts();
  const categories = await Category.find().sort('name').lean();
  const result = await Promise.all(categories.map(async (category) => ({
    _id: category._id,
    name: category.name,
    productCount: await Product.countDocuments({ category: { $regex: '^' + escapeRegExp(category.name) + '$', $options: 'i' } }),
  })));
  res.json(result);
});

router.post('/categories', async (req, res) => {
  const { name: rawName } = categoryInputSchema.parse(req.body ?? {});
  const name = rawName.replace(/\s+/g, ' ');
  const key = categoryKey(name);
  try {
    const category = await Category.create({ name, key });
    res.status(201).json({ _id: category._id, name: category.name, productCount: 0 });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That category already exists.' });
    throw error;
  }
});

router.delete('/categories/:id', async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  const inUse = await Product.exists({ category: { $regex: '^' + escapeRegExp(category.name) + '$', $options: 'i' } });
  if (inUse) return res.status(409).json({ message: 'Reassign or delete this category’s products before deleting the category.' });
  await Category.deleteOne({ _id: category._id });
  res.status(204).end();
});

router.post('/promo-codes', async (req, res) => {
  const input = promoCodeInputSchema.parse(req.body);
  if (input.startsAt && input.expiresAt && input.expiresAt <= input.startsAt)
    return res.status(400).json({ message: 'The expiry date must be later than the start date.' });
  try {
    res.status(201).json(await PromoCode.create({ ...input, code: input.code.toUpperCase() }));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A promo code with this name already exists' });
    throw error;
  }
});

router.patch('/promo-codes/:id/active', async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body ?? {});
  const promo = await PromoCode.findByIdAndUpdate(req.params.id, { active }, { new: true, runValidators: true });
  if (!promo) return res.status(404).json({ message: 'Promo code not found' });
  res.json(promo);
});

router.get('/products', (req, res) => listProducts(req, res, { includeUnitCost: true }));
router.post('/products', async (req, res) => {
  const input = productSchema.parse(req.body);
  const duplicate = await Product.findOne({ name: productNamePattern(input.name) }).select('name');
  if (duplicate) return res.status(409).json({ message: duplicateProductMessage(duplicate) });
  if (input.category) {
    const category = await Category.findOne({ key: categoryKey(input.category) });
    if (!category) return res.status(400).json({ message: 'Choose a category from the category list.' });
    input.category = category.name;
  }
  if (input.salePrice != null && input.salePrice >= input.price)
    return res.status(400).json({ message: 'Sale price must be lower than regular price.' });
  res.status(201).json(await Product.create(input));
});
router.patch('/products/:id/stock', async (req, res) => {
  const { delta } = z.object({ delta: z.number().int().min(-10000).max(10000).refine((value) => value !== 0, 'Enter a non-zero stock adjustment.') }).parse(req.body ?? {});
  const filter = { _id: req.params.id, ...(delta < 0 ? { stock: { $gte: -delta } } : {}) };
  const product = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true, runValidators: true });
  if (product) return res.json(product);
  if (!(await Product.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Product not found' });
  return res.status(409).json({ message: 'Stock cannot be reduced below zero.' });
});
router.put('/products/:id', async (req, res) => {
  const updates = productSchema.partial().omit({ stock: true }).parse(req.body);
  if (updates.category) {
    const category = await Category.findOne({ key: categoryKey(updates.category) });
    if (!category) return res.status(400).json({ message: 'Choose a category from the category list.' });
    updates.category = category.name;
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (updates.name && normalizeProductName(updates.name) !== normalizeProductName(product.name)) {
    const duplicate = await Product.findOne({
      _id: { $ne: product._id },
      name: productNamePattern(updates.name),
    }).select('name');
    if (duplicate) return res.status(409).json({ message: duplicateProductMessage(duplicate) });
  }
  const nextPrice = updates.price ?? product.price;
  const nextSalePrice = Object.prototype.hasOwnProperty.call(updates, 'salePrice') ? updates.salePrice : product.salePrice;
  if (nextSalePrice != null && nextSalePrice >= nextPrice)
    return res.status(400).json({ message: 'Sale price must be lower than regular price.' });
  product.set(updates);
  await product.save();
  res.json(product);
});
router.delete('/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

router.use('/uploads', uploadRoutes);

export default router;
