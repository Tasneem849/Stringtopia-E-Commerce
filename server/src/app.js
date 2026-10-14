import express from 'express';
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

// The Express app on its own: it does not listen or connect to the database, so tests can use it directly
export const app = express();
app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real visitor
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
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
app.use('/api/auth', rateLimit({ windowMs: 15 * 60e3, max: 100 }), authRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (err.name === 'ZodError') return res.status(400).json({ errors: err.flatten().fieldErrors });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error' });
});
