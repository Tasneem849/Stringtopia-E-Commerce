import { Router } from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';

const router = Router();
export const productSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  price: z.number().int().min(0),
  salePrice: z.number().int().min(0).nullable().optional(),
  images: z.array(z.string().url().startsWith('https://')).max(6).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  colors: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
});

const escapeRegExp = (value) =>
  [...value].map((character) => '.^$*+?()[]{}|\\'.includes(character) ? `\\${character}` : character).join('');

// Shared public catalog query, also used by the admin product manager.
export async function listProducts(req, res) {
  const { q, category, min, max, inStock, sort } = req.query;
  const limit = Math.min(+req.query.limit || 12, 50);
  const page = Math.max(+req.query.page || 1, 1);
  const filter = {};
  if (q) filter.$text = { $search: String(q) };
  const normalizedCategory = String(category ?? '').trim();
  if (normalizedCategory) {
    filter.category = { $regex: `^${escapeRegExp(normalizedCategory)}$`, $options: 'i' };
  }
  const effectivePrice = { $ifNull: ['$salePrice', '$price'] };
  const priceToUse = { $cond: [{ $lt: [effectivePrice, '$price'] }, effectivePrice, '$price'] };
  if (min || max) {
    const bounds = [];
    if (min) bounds.push({ $gte: [priceToUse, +min] });
    if (max) bounds.push({ $lte: [priceToUse, +max] });
    filter.$expr = { $and: bounds };
  }
  if (String(inStock).toLowerCase() === 'true') filter.stock = { $gt: 0 };
  const sortBy = ['price', '-price', '-createdAt'].includes(sort) ? sort : '-createdAt';

  const productQuery = ['price', '-price'].includes(sort)
    ? Product.aggregate([
      { $match: filter },
      { $addFields: { _effectivePrice: priceToUse } },
      { $sort: { _effectivePrice: sort === 'price' ? 1 : -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: { _effectivePrice: 0 } },
    ])
    : Product.find(filter).sort(sortBy).skip((page - 1) * limit).limit(limit);
  const [products, total] = await Promise.all([productQuery, Product.countDocuments(filter)]);
  res.json({ products, page, pages: Math.ceil(total / limit), total });
}

router.get('/', listProducts);
router.get('/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

export default router;
