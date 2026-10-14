import Category from './models/Category.js';
import Product from './models/Product.js';

const cleanCategoryName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');
export const categoryKey = (name) => cleanCategoryName(name).toLocaleLowerCase();

// Older products already store category names directly. Keep those visible and
// make them manageable without requiring a separate data migration.
export async function syncCategoriesFromProducts() {
  const names = await Product.distinct('category', { category: { $type: 'string', $ne: '' } });
  await Promise.all(names.map(async (value) => {
    const name = cleanCategoryName(value);
    const key = categoryKey(name);
    if (!key) return;
    try {
      await Category.updateOne({ key }, { $setOnInsert: { name, key } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }));
}

export async function getCatalogCategoryNames() {
  const [managedCategories, productNames] = await Promise.all([
    Category.find().select('name key').lean(),
    Product.distinct('category', { category: { $type: 'string', $ne: '' } }),
  ]);
  const byKey = new Map();
  for (const value of productNames) {
    const name = cleanCategoryName(value);
    const key = categoryKey(name);
    if (key) byKey.set(key, name);
  }
  for (const category of managedCategories) byKey.set(category.key, category.name);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
