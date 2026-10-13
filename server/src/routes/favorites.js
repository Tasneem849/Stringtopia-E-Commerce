import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, async (req, res) => {
  const user = await User.findById(req.user.id).populate('favorites');
  res.json((user?.favorites || []).filter(Boolean));
});

router.post('/:productId', protect, async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ message: 'Invalid product id' });
  if (!(await Product.exists({ _id: productId }))) return res.status(404).json({ message: 'Product not found' });
  await User.updateOne({ _id: req.user.id }, { $addToSet: { favorites: productId } });
  res.status(204).end();
});

router.delete('/:productId', protect, async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ message: 'Invalid product id' });
  await User.updateOne({ _id: req.user.id }, { $pull: { favorites: productId } });
  res.status(204).end();
});

export default router;
