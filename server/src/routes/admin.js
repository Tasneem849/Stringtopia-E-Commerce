import { Router } from 'express';
import { z } from 'zod';
import Order from '../models/Order.js';
import Category from '../models/Category.js';
import PromoCode from '../models/PromoCode.js';
import Product from '../models/Product.js';
import SiteSettings from '../models/SiteSettings.js';
import { mail } from '../email.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { categoryKey, syncCategoriesFromProducts } from '../categoryCatalog.js';
import { listProducts, productSchema } from './products.js';
import uploadRoutes from './uploads.js';

const router = Router();
const PAY_HOURS = 23;
const categoryInputSchema = z.object({ name: z.string().trim().min(2).max(40) });
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
  const order = await Order.findOneAndUpdate({
    _id: req.params.id,
    $or: [
      { status: { $in: ['requested', 'approved'] } },
      { status: 'pending', paymentMethod: { $in: ['instapay', 'cod'] } },
    ],
  }, { status: 'cancelled', promoUseHeld: false });
  if (!order) return res.status(409).json({ message: 'This order is no longer eligible for admin cancellation.' });
  if (order.stockHeld) await Promise.all(order.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } })));
  if (order.promoUseHeld && order.promoCode) {
    await PromoCode.updateOne({ code: order.promoCode, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
  }
  const cancelled = await Order.findById(order._id);
  mail.cancelled(cancelled);
  res.json(cancelled);
});

router.patch('/orders/:id/confirm-payment', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'instapay', paymentStatus: 'awaiting_confirmation' },
    { status: 'paid', paymentStatus: 'paid', promoUseHeld: false }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This InstaPay order is no longer awaiting confirmation' });
  mail.paid(order);
  res.json(order);
});

router.patch('/orders/:id/complete-cod', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ['pending', 'out_for_delivery'] }, paymentMethod: 'cod', paymentStatus: 'unpaid' },
    { status: 'shipped', paymentStatus: 'paid', promoUseHeld: false }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This cash-on-delivery order is no longer open' });
  mail.codCompleted(order);
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

router.get('/products', listProducts);
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
