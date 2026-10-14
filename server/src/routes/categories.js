import { Router } from 'express';
import { getCatalogCategoryNames } from '../categoryCatalog.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await getCatalogCategoryNames());
});

export default router;
