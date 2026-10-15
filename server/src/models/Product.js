import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 }, // regular price in piasters
  salePrice: {
    type: Number,
    min: 0,
    validate: { validator(value) { return value == null || value < this.price; }, message: 'Sale price must be lower than regular price' },
  }, // optional discounted price in piasters
  unitCost: { type: Number, min: 0, select: false, validate: { validator: Number.isSafeInteger, message: 'Unit cost must be a whole number of piasters' } }, // admin-only unit cost in piasters
  images: [String],
  category: { type: String, index: true },
  colors: [String],
  variantLabel: { type: String, trim: true, maxlength: 60, default: '' },
  variants: [{ type: String, trim: true, maxlength: 80 }],
  stock: { type: Number, default: 1, min: 0 },
}, { timestamps: true });

schema.index({ name: 'text', description: 'text' });
schema.pre('validate', function () {
  if (!this.slug) {
    this.slug = this.name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }
});

export default mongoose.model('Product', schema);
