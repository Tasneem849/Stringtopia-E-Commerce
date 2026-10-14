import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function protect(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not logged in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
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
export function optionalAuth(req, res, next) {
  try { req.user = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET); } catch {}
  next();
}
