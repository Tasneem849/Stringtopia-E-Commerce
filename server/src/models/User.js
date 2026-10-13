import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required() { return !this.googleId; }, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
}, { timestamps: true });

schema.pre('save', async function () {
  if (this.isModified('password') && this.password) this.password = await bcrypt.hash(this.password, 12);
});

export default mongoose.model('User', schema);
