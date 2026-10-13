import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Product from './models/Product.js';

await mongoose.connect(process.env.MONGO_URI);
if (!(await User.exists({ role: 'admin' }))) {
  await User.create({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' });
}

const products = [
  { name: 'Daisy Amigurumi', description: 'A hand-crocheted cotton daisy plush with a cheerful yellow center.', price: 18000, category: 'Amigurumi', colors: ['yellow', 'white'], stock: 5 },
  { name: 'Turtle Keychain', description: 'A tiny, hand-crocheted turtle charm for your keys or bag.', price: 40000, category: 'Keychains', colors: ['sage', 'oat'], stock: 8 },
  { name: 'Sea Collection', description: 'A coordinated set of ocean-inspired crochet accessories.', price: 100000, category: 'Collections', colors: ['blue', 'natural'], stock: 3 },
  { name: 'Chunky Beanie', description: 'A soft, warm beanie crocheted from a merino blend.', price: 55000, category: 'Wearables', colors: ['oat', 'sage'], stock: 8 },
  { name: 'Boho Market Bag', description: 'A sturdy cotton market tote with a relaxed boho stitch.', price: 75000, category: 'Bags', colors: ['natural'], stock: 3 },
  { name: 'Crochet Shopper Tote', description: 'A roomy cotton crochet tote for market trips and everyday errands.', price: 82000, category: 'Bags', colors: ['natural', 'terracotta'], stock: 4 },
  { name: 'Mini Crossbody Bag', description: 'A compact crochet crossbody bag with a comfortable handmade strap.', price: 64000, category: 'Bags', colors: ['sage', 'cream'], stock: 3 },
  { name: 'Strawberry Keychain', description: 'A sweet little strawberry charm, crocheted by hand.', price: 32000, category: 'Keychains', colors: ['red', 'green'], stock: 6 },
  { name: 'Mushroom Keychain', description: 'A soft mushroom bag charm with a spotted cap.', price: 35000, category: 'Keychains', colors: ['rust', 'cream'], stock: 5 },
  { name: 'Tiny Octopus Plush', description: 'A cuddly cotton octopus with curly, springy tentacles.', price: 42000, category: 'Amigurumi', colors: ['lilac', 'coral'], stock: 4 },
  { name: 'Blue Whale Plush', description: 'A gently rounded whale plush made for little hands and big hugs.', price: 48000, category: 'Amigurumi', colors: ['blue', 'cream'], stock: 4 },
  { name: 'Cloud Baby Blanket', description: 'A breathable, soft cotton blanket with a delicate textured stitch.', price: 85000, category: 'Baby & Kids', colors: ['cream', 'sage'], stock: 3 },
  { name: 'Sage Baby Booties', description: 'Lightweight crochet booties with a soft tie for a snug fit.', price: 38000, category: 'Baby & Kids', colors: ['sage', 'cream'], stock: 5 },
  { name: 'Daisy Coaster Set', description: 'A set of four cheerful cotton coasters to brighten your table.', price: 22000, category: 'Home & Lifestyle', colors: ['yellow', 'cream'], stock: 6 },
  { name: 'Willow Plant Hanger', description: 'A handmade hanging planter in a sturdy natural cotton cord.', price: 45000, category: 'Home & Lifestyle', colors: ['natural', 'sage'], stock: 4 },
  { name: 'Ribbed Crochet Scarf', description: 'A cozy, softly ribbed scarf for cool mornings and evening walks.', price: 68000, category: 'Wearables', colors: ['rose', 'oat'], stock: 5 },
  { name: 'Garden Gift Set', description: 'A gift-ready pairing of floral crochet keepsakes in pastel shades.', price: 95000, category: 'Collections', colors: ['pink', 'sage'], stock: 3 },
  { name: 'Made-to-Order Cardigan', description: 'A custom crochet cardigan made to your size and color choices.', price: 180000, category: 'Custom', colors: ['custom'], stock: 1 },
  { name: 'Made-to-Order Plush Friend', description: 'A personalized amigurumi companion made in your chosen colors.', price: 65000, category: 'Custom', colors: ['custom'], stock: 1 },
];

const existingNames = new Set(
  (await Product.find({}, 'name')).map(({ name }) => name.trim().toLocaleLowerCase()),
);
let added = 0;
for (const product of products) {
  const key = product.name.trim().toLocaleLowerCase();
  if (existingNames.has(key)) continue;
  await Product.create(product);
  existingNames.add(key);
  added += 1;
}

console.log(`Seeded admin if needed and added ${added} missing products.`);
await mongoose.disconnect();
