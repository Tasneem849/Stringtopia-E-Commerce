import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Product from './models/Product.js';

await mongoose.connect(process.env.MONGO_URI);
if (!(await User.exists({ role: 'admin' })))
  await User.create({ name: 'Admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' });
if (!(await Product.countDocuments()))
  await Product.create([
    { name: 'Daisy Amigurumi', description: 'Hand-crocheted cotton daisy plush.', price: 1800, category: 'Amigurumi', colors: ['yellow', 'white'], stock: 5 },
    { name: 'Turtle Keychain', description: 'Warm merino blend beanie.', price: 40000, category: 'Keychains', colors: ['oat', 'sage'], stock: 8 },
    { name: 'Sea Collection', description: 'Cute addition to your summer bag.', price: 100000, category: 'Collections', colors: ['natural'], stock: 3 },
    { name: 'Chunky Beanie', description: 'Warm merino blend beanie.', price: 55000, category: 'Wearables', colors: ['oat', 'sage'], stock: 8 },
    { name: 'Boho Market Bag', description: 'Sturdy cotton tote.', price: 75000, category: 'Wearables', colors: ['natural'], stock: 3 },
  ]);
console.log('Seeded');
await mongoose.disconnect();
