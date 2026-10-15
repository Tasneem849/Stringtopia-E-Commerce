import crypto from 'node:crypto';
import { isIP } from 'node:net';
import mongoose from 'mongoose';
import RateLimitBucket from '../models/RateLimitBucket.js';

export function rateLimitClientIp(req) {
  const address = String(req.headers['x-stringtopia-client-ip'] || '');
  const signature = String(req.headers['x-stringtopia-client-ip-signature'] || '');
  const secret = process.env.RATE_LIMIT_PROXY_SECRET;
  if (secret && secret.length >= 32 && isIP(address) && /^[a-f\d]{64}$/i.test(signature)) {
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(address).digest('hex'), 'hex');
    const supplied = Buffer.from(signature, 'hex');
    if (crypto.timingSafeEqual(expected, supplied)) return address;
  }
  return req.ip || 'unknown';
}

// Mongo-backed fixed windows keep limits consistent across Render instances and restarts.
// The in-memory path is only for isolated middleware use before a database is connected.
export function rateLimit({ scope = 'api', windowMs, max, keyGenerator = rateLimitClientIp }) {
  const localHits = new Map();

  return async (req, res, next) => {
    const now = Date.now();
    const keys = [...new Set([].concat(keyGenerator(req)).filter(Boolean).map(String))];
    if (!keys.length) keys.push(rateLimitClientIp(req));

    if (mongoose.connection.readyState !== 1) {
      let retryAfter = 0;
      for (const key of keys) {
        const bucketKey = `${scope}:${key}`;
        let bucket = localHits.get(bucketKey);
        if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
        bucket.count += 1;
        localHits.set(bucketKey, bucket);
        if (bucket.count > max) retryAfter = Math.max(retryAfter, bucket.resetAt - now);
      }
      if (retryAfter) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfter / 1000))));
        return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' });
      }
      return next();
    }

    const windowStart = Math.floor(now / windowMs) * windowMs;
    const expiresAt = new Date(windowStart + windowMs + 60 * 60 * 1000);
    try {
      const buckets = await Promise.all(keys.map(async (key) => {
        const id = crypto.createHash('sha256').update(`${scope}:${windowStart}:${key}`).digest('hex');
        try {
          return await RateLimitBucket.findOneAndUpdate(
            { _id: id },
            { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          ).select('count').lean();
        } catch (error) {
          // Concurrent first hits can race on the unique _id; retry as an ordinary increment.
          if (error?.code !== 11000) throw error;
          return RateLimitBucket.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true }).select('count').lean();
        }
      }));
      if (buckets.some((bucket) => bucket.count > max)) {
        const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' });
      }
      return next();
    } catch (error) {
      console.error('Persistent rate limiter unavailable:', error.message);
      return res.status(503).json({ code: 'RATE_LIMIT_UNAVAILABLE', message: 'Stringtopia could not check its security limits. Please try again shortly.' });
    }
  };
}
