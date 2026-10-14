import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const googleClient = new OAuth2Client();
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: u.role === 'admin' ? '30m' : '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const registerLimit = rateLimit({ windowMs: 15 * 60e3, max: 5 });
const loginLimit = rateLimit({
  windowMs: 15 * 60e3,
  max: 8,
  keyGenerator: (req) => [
    `login-ip:${req.ip || 'unknown'}`,
    `login-email:${String(req.body?.email || '').trim().toLowerCase() || 'missing'}`,
  ],
});

router.post('/register', registerLimit, async (req, res) => {
  const data = z.object({
    name: z.string().min(2).optional(), // email + password is enough to sign up
    email: z.string().email(),
    password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.'),
  }).parse(req.body);
  if (await User.exists({ email: data.email.toLowerCase() }))
    return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ ...data, name: data.name || data.email.split('@')[0] });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

router.post('/login', loginLimit, async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.') }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user?.password || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Wrong email or password' });
  res.json({ token: sign(user), user: pub(user) });
});

router.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ message: 'Google sign-in is not configured yet.' });

  const { credential } = z.object({ credential: z.string().min(1).max(10000) }).parse(req.body);
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: 'Google sign-in could not be verified. Please try again.' });
  }

  const parsedEmail = z.string().email().safeParse(payload?.email);
  if (!payload?.sub || !parsedEmail.success || payload.email_verified !== true)
    return res.status(401).json({ message: 'Google did not provide a verified email address.' });

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ googleId: payload.sub }).select('+googleId');
  let created = false;
  if (!user) {
    user = await User.findOne({ email }).select('+googleId +password');
    if (user) {
      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({ message: 'This email is linked to a different Google account. Please sign in with email and password.' });
      }
      // A verified Google identity proves control of this email. Remove any unverified
      // password registration before linking so its creator cannot retain access.
      if (user.password) user.password = undefined;
      user.googleId = payload.sub;
      await user.save();
    } else {
      const googleName = String(payload.name || '').trim().slice(0, 80);
      try {
        user = await User.create({
          name: googleName || email.split('@')[0].slice(0, 80),
          email,
          googleId: payload.sub,
        });
        created = true;
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ googleId: payload.sub }).select('+googleId');
        if (!user) return res.status(409).json({ message: 'An account already uses this email. Please sign in with email and password.' });
      }
    }
  }

  res.status(created ? 201 : 200).json({ token: sign(user), user: pub(user) });
});

router.get('/me', protect, async (req, res) => {
  res.json(pub(await User.findById(req.user.id)));
});

export default router;
