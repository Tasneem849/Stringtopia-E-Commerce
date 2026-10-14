import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  key: { type: String, required: true, unique: true },
}, { timestamps: true });

export default mongoose.model('Category', schema);
