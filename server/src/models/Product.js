import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 }, // in cents
  images: [String],
  category: { type: String, index: true },
  colors: [String],
  stock: { type: Number, default: 1, min: 0 },
}, { timestamps: true });

schema.index({ name: 'text', description: 'text' });
schema.pre('validate', function () {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }
});

export default mongoose.model('Product', schema);
