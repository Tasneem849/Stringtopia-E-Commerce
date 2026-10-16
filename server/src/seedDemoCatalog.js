import 'dotenv/config';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import Category from './models/Category.js';
import { syncCategoriesFromProducts } from './categoryCatalog.js';

const demoDatabaseName = 'stringtopia_demo';

function assertDemoDatabase(uri) {
  let databaseName = '';
  try { databaseName = decodeURIComponent(new URL(uri).pathname.split('/')[1] || ''); } catch {}
  if (databaseName !== demoDatabaseName) {
    throw new Error(`Refusing to seed: MONGO_URI must point to the isolated ${demoDatabaseName} database.`);
  }
}

function catalogEndpoint(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('SOURCE_CATALOG_URL must use HTTPS.');
  return url;
}

async function readCatalogPage(endpoint, page) {
  const url = new URL(endpoint);
  url.searchParams.set('limit', '50');
  url.searchParams.set('page', String(page));
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Public catalog request failed with HTTP ${response.status}.`);
  const data = await response.json();
  if (!Array.isArray(data.products) || !Number.isInteger(data.pages)) {
    throw new Error('The public catalog returned an unexpected response.');
  }
  return data;
}

function publicProduct(product) {
  if (!product || typeof product.name !== 'string' || typeof product.slug !== 'string') return null;
  const images = Array.isArray(product.images)
    ? product.images.filter((image) => typeof image === 'string' && image.startsWith('https://')).slice(0, 6)
    : [];
  return {
    name: product.name,
    slug: product.slug,
    description: typeof product.description === 'string' ? product.description : '',
    price: Number.isSafeInteger(product.price) ? product.price : 0,
    ...(Number.isSafeInteger(product.salePrice) ? { salePrice: product.salePrice } : {}),
    images,
    category: typeof product.category === 'string' ? product.category : '',
    colors: Array.isArray(product.colors) ? product.colors.filter((color) => typeof color === 'string') : [],
    variantLabel: typeof product.variantLabel === 'string' ? product.variantLabel : '',
    variants: Array.isArray(product.variants) ? product.variants.filter((variant) => typeof variant === 'string') : [],
    stock: Number.isSafeInteger(product.stock) ? Math.max(0, product.stock) : 0,
  };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI to the isolated demo database.');
  if (!process.env.SOURCE_CATALOG_URL) throw new Error('Set SOURCE_CATALOG_URL to the public catalog endpoint.');
  assertDemoDatabase(process.env.MONGO_URI);
  const endpoint = catalogEndpoint(process.env.SOURCE_CATALOG_URL);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Product.createIndexes(), Category.createIndexes()]);

  const firstPage = await readCatalogPage(endpoint, 1);
  if (firstPage.pages > 20) throw new Error('The public catalog is unexpectedly large; refusing to import more than 1,000 products.');
  const products = [...firstPage.products];
  for (let page = 2; page <= firstPage.pages; page += 1) {
    const data = await readCatalogPage(endpoint, page);
    products.push(...data.products);
  }

  const safeProducts = products.map(publicProduct).filter(Boolean);
  if (!safeProducts.length) throw new Error('No public products were found; the demo database was not changed.');

  const slugs = safeProducts.map(({ slug }) => slug);
  await Product.deleteMany({ slug: { $nin: slugs } });
  await Product.bulkWrite(safeProducts.map((product) => ({
    replaceOne: { filter: { slug: product.slug }, replacement: product, upsert: true },
  })), { ordered: false });
  const categoryNames = [...new Set(safeProducts.map((product) => product.category).filter(Boolean))];
  const categoryKeys = categoryNames.map((name) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase());
  await Category.deleteMany({ key: { $nin: categoryKeys } });
  await syncCategoriesFromProducts();
  console.log(`Imported ${safeProducts.length} public products and synced their categories into ${demoDatabaseName}.`);
  console.log('Only products and product-derived categories were written; no customer, order, or payment records were imported.');
}

try {
  await main();
} catch (error) {
  console.error(`Demo catalog import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
