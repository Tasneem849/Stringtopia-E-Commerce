import crypto from 'node:crypto';
import mongoose from 'mongoose';

// In stock:     pending   -> paid -> shipped             (stock is held while the customer pays)
// Not enough stock: requested -> approved -> paid -> shipped (made to order, no stock involved)
// Open orders can end as declined, cancelled or expired; held stock is released
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // empty for guest orders
  accountDeletionDataPending: { type: Boolean, default: false, index: true }, // scrub personal details after an account's open order/refund is resolved
  email: String,
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    variantLabel: String,
    variant: String,
    price: Number, // snapshot at purchase time
    unitCost: { type: Number, select: false, validate: { validator: Number.isSafeInteger, message: 'Unit cost must be a whole number of piasters' } }, // admin-only cost snapshot in piasters
    qty: Number,
  }],
  total: Number,
  promoCode: { type: String, trim: true, uppercase: true },
  discountAmount: { type: Number, default: 0, min: 0 },
  promoUseHeld: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['paymob', 'instapay', 'cod', 'cash'], default: 'paymob', index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'awaiting_confirmation', 'paid'], default: 'unpaid', index: true },
  paidAt: Date,
  orderSource: { type: String, enum: ['website', 'whatsapp', 'phone'], default: 'website', index: true },
  instaPayReference: { type: String, trim: true },
  instaPayProofMethod: { type: String, enum: ['reference', 'whatsapp'] },
  instaPayProofSubmittedAt: Date,
  paymobReference: { type: String, trim: true },
  // Keep every intention order ID: a customer can start a fresh checkout for each retry.
  paymobOrderIds: [{ type: String, trim: true }],
  // Legacy scalar retained so existing orders created before paymobOrderIds can still settle.
  paymobOrderId: { type: String, trim: true },
  paymobTransactionId: { type: String, trim: true },
  refundStatus: { type: String, enum: ['not_required', 'processing', 'refunded', 'manual_required', 'failed'], default: 'not_required', index: true },
  refundAmount: { type: Number, min: 0 }, // piasters; the full amount charged to the customer
  refundRequestedAt: Date,
  refundReconciliationCheckedAt: Date,
  refundedAt: Date,
  refundError: { type: String, maxlength: 300 },
  paymobRefundTransactionId: { type: String, trim: true },
  cancelledAt: Date,
  checkoutIpHash: { type: String, select: false },
  paymentReconciliationCheckedAt: Date,
  paymentIssueReportedAt: Date,
  status: {
    type: String,
    enum: ['requested', 'pending', 'approved', 'paid', 'out_for_delivery', 'shipped', 'declined', 'cancelled', 'expired'],
    default: 'pending',
    index: true,
  },
  note: String,          // customer's message with a reservation request
  declineReason: String, // seller's message when declining
  cancellationReason: { type: String, trim: true, maxlength: 300 }, // optional admin explanation shared with the customer
  expiresAt: Date,       // deadline to pay after approval
  eta: String,           // seller's estimate, e.g. "ready in 2 weeks"
  stockHeld: { type: Boolean, default: false }, // true for direct checkout
  // unguessable key for payment links and the guest thank-you page
  publicToken: { type: String, unique: true, sparse: true, default: () => crypto.randomBytes(16).toString('hex') },
  customer: { name: String, phone: String }, // who is paying; also the billing details sent to Paymob
  paymentAttempts: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 }, // piasters; 0 for pickup
  delivery: {
    method: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
    gift: Boolean, // sent to someone else
    recipientName: String,
    phone: String,
    address: { line1: String, line2: String, city: String, postalCode: String, country: String },
    giftMessage: String,
  },
}, { timestamps: true });

schema.index({ status: 1, createdAt: 1 });
schema.index({ checkoutIpHash: 1, status: 1 });
schema.index({ paymentStatus: 1, paidAt: 1, status: 1 });
schema.index({ paymobTransactionId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Order', schema);
