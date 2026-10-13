import jwt from 'jsonwebtoken';

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

export const adminOnly = (req, res, next) =>
  req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admins only' });

// For routes that also work for guests: attach the user if a valid token is sent, otherwise carry on as a guest.
export function optionalAuth(req, res, next) {
  try { req.user = jwt.verify(req.headers.authorization?.split(' ')[1], process.env.JWT_SECRET); } catch {}
  next();
}
