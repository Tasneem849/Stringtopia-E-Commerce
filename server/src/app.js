import express from 'express';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import favoriteRoutes from './routes/favorites.js';
import orderRoutes, { webhook } from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import SiteSettings from './models/SiteSettings.js';

// A trailing slash on these would break CORS and the links we build
for (const key of ['CLIENT_URL', 'API_URL']) {
  if (process.env[key]) process.env[key] = process.env[key].replace(/\/+$/, '');
}

const configuredClientOrigins = new Set(
  (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
);

function isAllowedClientOrigin(origin) {
  if (!origin || configuredClientOrigins.has(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

// Express routes without starting a listener; Render/local and Vercel use separate entry points.
export const app = express();
app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real visitor
let mongoConnectionPromise;
const readOnlyDeployment = process.env.DEMO_READ_ONLY === 'true' || process.env.VERCEL === '1';

async function connectForServerlessRequest() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');
  if (process.env.VERCEL === '1') {
    let databaseName = '';
    try { databaseName = decodeURIComponent(new URL(process.env.MONGO_URI).pathname.split('/')[1] || ''); } catch {}
    if (databaseName !== 'stringtopia_demo') {
      throw new Error('The Vercel demo API requires a dedicated MongoDB database named stringtopia_demo.');
    }
  }
  if (mongoose.connection.readyState === 2 && mongoConnectionPromise) {
    await mongoConnectionPromise;
    return;
  }
  if (mongoose.connection.readyState !== 2) mongoConnectionPromise = null;
  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false })
      .catch((error) => {
        mongoConnectionPromise = null;
        throw error;
      });
  }
  await mongoConnectionPromise;
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedClientOrigin(origin));
  },
}));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
// Vercel deployments stay read-only even if the demo flag is accidentally omitted.
if (readOnlyDeployment) {
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return res.status(403).json({
      code: 'DEMO_READ_ONLY',
      message: 'This Stringtopia demo is read-only. Ordering and account features are disabled.',
    });
  });
}

// Vercel runs this app as a function. Reuse one Mongo connection per warm instance.
if (process.env.VERCEL === '1') {
  app.use(async (req, res, next) => {
    try {
      await connectForServerlessRequest();
      next();
    } catch (error) {
      error.status = 503;
      next(error);
    }
  });
}
app.use(express.json());
// Paymob calls this after each payment attempt; the handler verifies the request's HMAC signature
app.post('/api/orders/webhook', webhook);

app.get('/api/health', (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ ok });
});
// Public store settings: one source of truth for the fee and pickup address
app.get('/api/config', async (req, res) => {
  const settings = mongoose.connection.readyState === 1
    ? await SiteSettings.findById('global').select('backgroundAudioUrl').lean().catch(() => null)
    : null;
  res.json({
    deliveryFee: +process.env.DELIVERY_FEE || 0,
    pickupAddress: process.env.PICKUP_ADDRESS || '',
    instaPayAddress: process.env.INSTAPAY_ADDRESS || '',
    instaPayAccountName: process.env.INSTAPAY_ACCOUNT_NAME || '',
    instaPayWhatsapp: process.env.INSTAPAY_WHATSAPP || '',
    backgroundAudioUrl: settings?.backgroundAudioUrl || '',
  });
});
app.use('/api/auth', rateLimit({ scope: 'auth-general', windowMs: 15 * 60e3, max: 100 }), authRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ code: 'API_ROUTE_NOT_FOUND', message: 'That Stringtopia service endpoint could not be found.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'ZodError') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the submitted details and try again.', errors: err.flatten().fieldErrors });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'INVALID_REQUEST_BODY', message: 'We couldn’t read those details. Check the form and try again.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ code: 'REQUEST_TOO_LARGE', message: 'That upload is too large. Choose a smaller file and try again.' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ code: 'INVALID_ID', message: 'That item could not be found. Refresh the page and try again.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ code: 'ALREADY_EXISTS', message: 'That record already exists. Refresh the page and check the current list.' });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.fromEntries(Object.entries(err.errors || {}).map(([field, issue]) => [field, [issue.message]]));
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Please check the submitted details and try again.', errors });
  }

  const reportedStatus = Number(err.status || err.statusCode);
  const status = reportedStatus >= 400 && reportedStatus <= 599 ? reportedStatus : 500;
  if (status >= 500) {
    console.error(`[${req.requestId || 'no-request-id'}] ${req.method} ${req.path}`, err);
    if (status === 503 && err.message) {
      return res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: err.message });
    }
    const code = status === 500 ? 'INTERNAL_SERVER_ERROR' : 'SERVICE_UNAVAILABLE';
    return res.status(status).json({
      code,
      requestId: req.requestId,
      message: 'Stringtopia hit a temporary problem. Please try again shortly.',
    });
  }

  const safeStatus = status >= 400 && status < 500 ? status : 500;
  return res.status(safeStatus).json({ message: err.message || 'We couldn’t complete that request. Please check the details and try again.' });
});

export default app;
