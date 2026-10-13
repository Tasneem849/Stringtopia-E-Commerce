import { Router } from 'express';
import { z } from 'zod';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import SiteSettings from '../models/SiteSettings.js';
import { mail } from '../email.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { listProducts, productSchema } from './products.js';
import uploadRoutes from './uploads.js';

const router = Router();
const PAY_HOURS = 23;
const cloudinaryAudioUrl = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.includes('/video/upload/');
}, 'Use a secure Cloudinary audio upload URL');

// Every endpoint in this namespace requires a valid admin session.
router.use(protect, adminOnly);

router.get('/orders', async (req, res) => {
  const filter = req.query.status ? { status: String(req.query.status) } : {};
  res.json(await Order.find(filter).populate('user', 'name email').sort('-createdAt'));
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

router.patch('/orders/:id/confirm-payment', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'instapay', paymentStatus: 'awaiting_confirmation' },
    { status: 'paid', paymentStatus: 'paid' }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This InstaPay order is no longer awaiting confirmation' });
  mail.paid(order);
  res.json(order);
});

router.patch('/orders/:id/complete-cod', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: 'pending', paymentMethod: 'cod', paymentStatus: 'unpaid' },
    { status: 'shipped', paymentStatus: 'paid' }, { new: true },
  );
  if (!order) return res.status(409).json({ message: 'This cash-on-delivery order is no longer open' });
  mail.codCompleted(order);
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

router.get('/products', listProducts);
router.post('/products', async (req, res) => {
  res.status(201).json(await Product.create(productSchema.parse(req.body)));
});
router.put('/products/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, productSchema.partial().parse(req.body), { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});
router.delete('/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

router.use('/uploads', uploadRoutes);

export default router;