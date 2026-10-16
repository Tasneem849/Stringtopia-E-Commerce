import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();

// This router is mounted inside /api/admin, which applies the database-backed admin guard before every route.
router.get('/sign', (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) {
    return res.status(503).json({ message: 'Image uploads are not set up yet. Add the three CLOUDINARY_ values to the server .env file.' });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'stringtopia';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  res.json({ cloudName, apiKey, timestamp, folder, signature });
});

router.get('/audio-sign', (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) {
    return res.status(503).json({ message: 'Audio uploads are not set up yet. Add the three CLOUDINARY_ values to the server .env file.' });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'stringtopia/audio';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  res.json({ cloudName, apiKey, timestamp, folder, signature, resourceType: 'video' });
});

export default router;
