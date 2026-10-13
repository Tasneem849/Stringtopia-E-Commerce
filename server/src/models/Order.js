import crypto from 'node:crypto';
import mongoose from 'mongoose';

// In stock:     pending   -> paid -> shipped             (stock is held while the customer pays)
// Not enough stock: requested -> approved -> paid -> shipped (made to order, no stock involved)
// Open orders can end as declined, cancelled or expired; held stock is released
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty for guest orders
  email: String,
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number, // snapshot at purchase time
    qty: Number,
  }],
  total: Number,
  paymentMethod: { type: String, enum: ['paymob', 'instapay', 'cod'], default: 'paymob', index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'awaiting_confirmation', 'paid'], default: 'unpaid', index: true },
  instaPayReference: { type: String, trim: true },
  status: {
    type: String,
    enum: ['requested', 'pending', 'approved', 'paid', 'shipped', 'declined', 'cancelled', 'expired'],
    default: 'pending',
    index: true,
  },
  note: String,          // customer's message with a reservation request
  declineReason: String, // seller's message when declining
  expiresAt: Date,       // deadline to pay after approval
  eta: String,           // seller's estimate, e.g. "ready in 2 weeks"
  stockHeld: { type: Boolean, default: false }, // true for direct checkout
  // unguessable key for payment links and the guest thank-you page
  publicToken: { type: String, unique: true, sparse: true, default: () => crypto.randomBytes(16).toString('hex') },
  customer: { name: String, phone: String }, // who is paying; also the billing details sent to Paymob
  paymentAttempts: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 }, // cents; 0 for pickup
  delivery: {
    method: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
    gift: Boolean, // sent to someone else
    recipientName: String,
    phone: String,
    address: { line1: String, line2: String, city: String, postalCode: String, country: String },
    giftMessage: String,
  },
}, { timestamps: true });

export default mongoose.model('Order', schema);
