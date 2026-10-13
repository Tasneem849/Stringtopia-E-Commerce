import { Router } from 'express';
import crypto from 'node:crypto';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

// Admins upload straight from the browser to Cloudinary. This route only signs the request, so photos
// never pass through the API and nobody without an admin login can upload to your Cloudinary account.
router.get('/sign', protect, adminOnly, (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) {
    return res.status(503).json({ message: 'Image uploads are not set up yet. Add the three CLOUDINARY_ values to the server .env file.' });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'stringtopia';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  res.json({ cloudName, apiKey, timestamp, folder, signature });
});

export default router;
