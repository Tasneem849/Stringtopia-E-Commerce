import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adminName: { type: String, maxlength: 80 },
  adminEmail: { type: String, maxlength: 254 },
  method: { type: String, enum: ['POST', 'PUT', 'PATCH', 'DELETE'], required: true },
  route: { type: String, required: true },
  action: { type: String, maxlength: 120 },
  resourceType: { type: String, maxlength: 40 },
  resourceId: { type: String, maxlength: 100 },
  summary: { type: String, maxlength: 500 },
  status: { type: Number, required: true },
  requestId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

schema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', schema);
