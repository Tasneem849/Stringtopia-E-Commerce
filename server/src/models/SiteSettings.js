import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  backgroundAudioUrl: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.SiteSettings || mongoose.model('SiteSettings', schema);
