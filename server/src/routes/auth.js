import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = Router();
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/register', async (req, res) => {
  const data = z.object({
    name: z.string().min(2).optional(), // email + password is enough to sign up
    email: z.string().email(),
    password: z.string().min(8),
  }).parse(req.body);
  if (await User.exists({ email: data.email.toLowerCase() }))
    return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ ...data, name: data.name || data.email.split('@')[0] });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Wrong email or password' });
  res.json({ token: sign(user), user: pub(user) });
});

router.get('/me', protect, async (req, res) => {
  res.json(pub(await User.findById(req.user.id)));
});

export default router;
