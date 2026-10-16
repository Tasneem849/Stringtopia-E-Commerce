import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import { sweep } from './routes/orders.js';
import { sweepAccountDeletions } from './accountDeletion.js';
import { app } from './app.js';

// Fail fast with a clear message instead of failing later in strange ways
const requiredEnvironment = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'];
if (process.env.NODE_ENV === 'production') requiredEnvironment.push('RATE_LIMIT_PROXY_SECRET');
for (const key of requiredEnvironment) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}
if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_PROXY_SECRET.length < 32) {
  throw new Error('RATE_LIMIT_PROXY_SECRET must contain at least 32 characters.');
}

const paymobCheckoutConfigured = Boolean(process.env.PAYMOB_SECRET_KEY || process.env.PAYMOB_PUBLIC_KEY || process.env.PAYMOB_INTEGRATION_IDS);
if (paymobCheckoutConfigured && !process.env.PAYMOB_API_KEY) {
  console.warn('Paymob checkout is configured without PAYMOB_API_KEY. Payment inquiries and automatic refunds will be unavailable.');
}

await mongoose.connect(process.env.MONGO_URI);

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_TOTP_SECRET) {
  console.error('ADMIN_TOTP_SECRET is missing; production admin sign-in will remain locked until it is configured.');
}

// First boot: create the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if there is none yet
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !(await User.exists({ role: 'admin' }))) {
  await User.create({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' })
    .then(() => console.log('Admin account created'))
    .catch((e) => console.error('Could not create the admin account:', e.message));
}

const runSweeps = () => Promise.all([sweep(), sweepAccountDeletions()]).catch(console.error);
void runSweeps();
const sweepTimer = setInterval(runSweeps, 10 * 60 * 1000);
const server = app.listen(process.env.PORT || 5000, () => console.log('Stringtopia API running'));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing Stringtopia API gracefully`);
  clearInterval(sweepTimer);
  const forceClose = setTimeout(() => server.closeAllConnections(), 10000);
  forceClose.unref();
  server.close(async () => {
    clearTimeout(forceClose);
    await mongoose.disconnect();
  });
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
