import { Router } from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();
const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().int().min(0),
  images: z.array(z.string().url().startsWith('https://')).max(6).optional(),
  category: z.string().optional(),
  colors: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
});

// GET /api/products?q=&category=&min=&max=&sort=price|-price|-createdAt&page=&limit=
router.get('/', async (req, res) => {
  const { q, category, min, max, sort } = req.query;
  const limit = Math.min(+req.query.limit || 12, 50);
  const page = Math.max(+req.query.page || 1, 1);
  const filter = {};
  if (q) filter.$text = { $search: String(q) };
  if (category) filter.category = String(category);
  if (min || max) filter.price = { ...(min && { $gte: +min }), ...(max && { $lte: +max }) };
  const sortBy = ['price', '-price', '-createdAt'].includes(sort) ? sort : '-createdAt';

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products, page, pages: Math.ceil(total / limit), total });
});

router.get('/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

router.post('/', protect, adminOnly, async (req, res) => {
  res.status(201).json(await Product.create(productSchema.parse(req.body)));
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, productSchema.partial().parse(req.body), { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;
