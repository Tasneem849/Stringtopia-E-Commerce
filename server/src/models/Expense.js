import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: ['materials', 'packaging', 'shipping', 'marketing', 'tools', 'other'], required: true, index: true },
  amount: { type: Number, required: true, min: 1 }, // piasters
  date: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: true });

schema.index({ date: -1, createdAt: -1 });

export default mongoose.model('Expense', schema);
