import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import { sweep } from './routes/orders.js';
import { app } from './app.js';

// Fail fast with a clear message instead of failing later in strange ways
for (const key of ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL']) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

await mongoose.connect(process.env.MONGO_URI);

// First boot: create the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if there is none yet
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !(await User.exists({ role: 'admin' }))) {
  await User.create({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' })
    .then(() => console.log('Admin account created'))
    .catch((e) => console.error('Could not create the admin account:', e.message));
}

const sweepTimer = setInterval(() => sweep().catch(console.error), 10 * 60 * 1000);
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
