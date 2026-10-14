import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z0-9_-]{3,24}$/,
  },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  active: { type: Boolean, default: true, index: true },
  startsAt: Date,
  expiresAt: Date,
  minimumOrder: { type: Number, default: 0, min: 0 }, // piasters
  usageLimit: { type: Number, min: 1 },
  redemptionCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default mongoose.models.PromoCode || mongoose.model('PromoCode', schema);
