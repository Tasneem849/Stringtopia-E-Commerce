// Tiny in-memory limiter: at most `max` requests per `windowMs` for each visitor (IP). Fine for a single server.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const count = (hits.get(req.ip) ?? 0) + 1;
    hits.set(req.ip, count);
    if (count > max) return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
    next();
  };
}
