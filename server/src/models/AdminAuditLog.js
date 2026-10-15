import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: ['POST', 'PUT', 'PATCH', 'DELETE'], required: true },
  route: { type: String, required: true },
  status: { type: Number, required: true },
  requestId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', schema);
