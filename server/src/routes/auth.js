import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { rateLimit, rateLimitClientIp } from '../middleware/rateLimit.js';
import { ACCOUNT_DELETION_GRACE_MS, finalizeAccountDeletion } from '../accountDeletion.js';
import { verifyAdminTotp } from '../totp.js';

const router = Router();
const googleClient = new OAuth2Client();
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: u.role === 'admin' ? '30m' : '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const registerLimit = rateLimit({ scope: 'auth-register', windowMs: 15 * 60e3, max: 5 });
const loginLimit = rateLimit({
  scope: 'auth-login',
  windowMs: 15 * 60e3,
  max: 8,
  keyGenerator: (req) => [
    `login-ip:${rateLimitClientIp(req)}`,
    `login-email:${String(req.body?.email || '').trim().toLowerCase() || 'missing'}`,
  ],
});
const googleLimit = rateLimit({ scope: 'auth-google', windowMs: 15 * 60e3, max: 10 });
const deletionFields = 'deletionRequestedAt deletionScheduledFor deletionFinalizingAt';

function requireAdminTotp(user, code, res) {
  if (user?.role !== 'admin') return true;
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return true;
    res.status(503).json({ code: 'ADMIN_MFA_NOT_CONFIGURED', message: 'Admin sign-in is temporarily locked until the shop owner configures the authenticator secret in the API environment.' });
    return false;
  }
  if (!verifyAdminTotp(code, secret)) {
    res.status(401).json({
      code: code ? 'ADMIN_MFA_INVALID' : 'ADMIN_MFA_REQUIRED',
      message: code ? 'That authenticator code is incorrect or expired. Enter the latest six-digit code and try again.' : 'Enter the six-digit code from the shop administrator’s authenticator app to continue.',
    });
    return false;
  }
  return true;
}

function deletionIsDue(user) {
  return Boolean(user?.deletionScheduledFor && user.deletionScheduledFor <= new Date());
}

router.post('/register', registerLimit, async (req, res) => {
  const data = z.object({
    name: z.string().min(2).optional(), // email + password is enough to sign up
    email: z.string().email(),
    password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.'),
  }).parse(req.body);
  const existing = await User.findOne({ email: data.email.toLowerCase() }).select('deletionScheduledFor');
  if (existing && deletionIsDue(existing)) await finalizeAccountDeletion(existing._id);
  else if (existing) return res.status(409).json({ code: 'EMAIL_ALREADY_REGISTERED', message: 'This email already has an account.' });
  let user;
  try {
    user = await User.create({ ...data, name: data.name || data.email.split('@')[0] });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ code: 'EMAIL_ALREADY_REGISTERED', message: 'This email already has an account.' });
    throw error;
  }
  res.status(201).json({ token: sign(user), user: pub(user) });
});

router.post('/login', loginLimit, async (req, res) => {
  const { email, password, totpCode } = z.object({
    email: z.string().email(),
    password: z.string().max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.'),
    totpCode: z.string().max(6).optional(),
  }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND', message: 'No account found for this email.' });
  if (!user.password)
    return res.status(401).json({ code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'This account uses Google sign-in. Choose Continue with Google to log in.' });
  if (!(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ code: 'INCORRECT_PASSWORD', message: 'The password does not match this email. Please check it and try again.' });
  if (deletionIsDue(user)) {
    await finalizeAccountDeletion(user._id);
    return res.status(410).json({ message: 'The scheduled account deletion has taken effect.' });
  }
  if (!requireAdminTotp(user, totpCode, res)) return;
  res.json({ token: sign(user), user: pub(user) });
});

router.post('/google', googleLimit, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ message: 'Google sign-in is not configured yet.' });

  const { credential, totpCode } = z.object({ credential: z.string().min(1).max(10000), totpCode: z.string().max(6).optional() }).parse(req.body);
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
      if (user.role === 'admin' && !requireAdminTotp(user, totpCode, res)) return;
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

  if (deletionIsDue(user)) {
    await finalizeAccountDeletion(user._id);
    return res.status(410).json({ message: 'The scheduled account deletion has taken effect.' });
  }
  if (!requireAdminTotp(user, totpCode, res)) return;
  res.status(created ? 201 : 200).json({ token: sign(user), user: pub(user) });
});

router.get('/account-deletion', protect, async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Self-service deletion is available for customer accounts.' });
  const user = await User.findById(req.user.id).select(deletionFields).lean();
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json({ requestedAt: user.deletionRequestedAt || null, scheduledFor: user.deletionScheduledFor || null });
});

router.post('/account-deletion', protect, async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Self-service deletion is available for customer accounts.' });
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_MS);
  let user = await User.findOneAndUpdate({
    _id: req.user.id,
    role: 'customer',
    deletionScheduledFor: { $exists: false },
    deletionFinalizingAt: { $exists: false },
  }, { $set: { deletionRequestedAt: now, deletionScheduledFor: scheduledFor } }, { new: true }).select(deletionFields).lean();
  if (!user) user = await User.findById(req.user.id).select(`role ${deletionFields}`).lean();
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  if (user.role !== 'customer') return res.status(403).json({ message: 'Self-service deletion is available for customer accounts.' });
  if (user.deletionFinalizingAt) return res.status(409).json({ message: 'Account deletion is already being finalized.' });
  if (!user.deletionScheduledFor) return res.status(409).json({ message: 'Could not schedule account deletion. Please try again.' });
  res.json({ requestedAt: user.deletionRequestedAt, scheduledFor: user.deletionScheduledFor });
});

router.delete('/account-deletion', protect, async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Self-service deletion is available for customer accounts.' });
  const now = new Date();
  const user = await User.findOneAndUpdate({
    _id: req.user.id,
    role: 'customer',
    deletionScheduledFor: { $gt: now },
    deletionFinalizingAt: { $exists: false },
  }, { $unset: { deletionRequestedAt: '', deletionScheduledFor: '' } }, { new: true }).select(deletionFields).lean();
  if (user) return res.json({ cancelled: true, requestedAt: null, scheduledFor: null });

  const current = await User.findById(req.user.id).select(`role ${deletionFields}`).lean();
  if (!current) return res.status(404).json({ message: 'Account not found.' });
  if (current.role !== 'customer') return res.status(403).json({ message: 'Self-service deletion is available for customer accounts.' });
  if (current.deletionFinalizingAt || deletionIsDue(current)) {
    await finalizeAccountDeletion(current._id);
    return res.status(410).json({ message: 'The deletion grace period has ended; this account is being removed.' });
  }
  return res.json({ cancelled: false, requestedAt: null, scheduledFor: null });
});

router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json(pub(user));
});

export default router;
