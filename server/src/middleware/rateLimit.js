// Small single-instance fixed-window limiter. keyGenerator may return several buckets
// (for example IP + normalized email) and every bucket must be under its own limit.
export function rateLimit({ windowMs, max, keyGenerator = (req) => req.ip || 'unknown' }) {
  const hits = new Map();
  let requestsSinceCleanup = 0;

  return (req, res, next) => {
    const now = Date.now();
    const keys = [...new Set([].concat(keyGenerator(req)).filter(Boolean).map(String))];
    if (!keys.length) keys.push(req.ip || 'unknown');

    if (++requestsSinceCleanup >= 1000) {
      requestsSinceCleanup = 0;
      for (const [key, bucket] of hits) if (bucket.resetAt <= now) hits.delete(key);
    }

    let retryAfter = 0;
    for (const key of keys) {
      let bucket = hits.get(key);
      if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
      bucket.count += 1;
      hits.set(key, bucket);
      if (bucket.count > max) retryAfter = Math.max(retryAfter, bucket.resetAt - now);
    }

    if (retryAfter) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfter / 1000))));
      return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
}
