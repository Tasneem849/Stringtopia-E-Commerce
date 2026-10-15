import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { finalizeAccountDeletion } from '../accountDeletion.js';

export async function protect(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not logged in' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    const account = await User.findById(payload.id).select('role deletionScheduledFor deletionFinalizingAt').lean();
    if (!account) return res.status(401).json({ message: 'This account is no longer available. Please log in again.' });
    if (account.deletionFinalizingAt || (account.deletionScheduledFor && account.deletionScheduledFor <= new Date())) {
      await finalizeAccountDeletion(account._id);
      return res.status(401).json({ message: 'The scheduled account deletion has taken effect.' });
    }
    req.user = { ...payload, role: account.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function adminOnly(req, res, next) {
  try {
    const user = req.user?.id ? await User.findById(req.user.id).select('role').lean() : null;
    if (!user) return res.status(401).json({ message: 'Admin session is no longer valid. Please log in again.' });
    if (user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    next();
  } catch (error) {
    next(error);
  }
}

// For routes that also work for guests: attach the user if a valid token is sent, otherwise carry on as a guest.
export async function optionalAuth(req, res, next) {
  let payload;
  try { payload = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET); } catch { return next(); }
  try {
    const account = await User.findById(payload.id).select('role deletionScheduledFor deletionFinalizingAt').lean();
    if (!account) return next();
    if (account.deletionFinalizingAt || (account.deletionScheduledFor && account.deletionScheduledFor <= new Date())) {
      await finalizeAccountDeletion(account._id);
      return next();
    }
    req.user = { ...payload, role: account.role };
    return next();
  } catch (error) {
    return next(error);
  }
}
