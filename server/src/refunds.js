import Order from './models/Order.js';
import { inquireTransactionById, refundTransaction } from './paymob.js';

// Atomically claim one provider refund request. An ambiguous timeout remains processing so a
// second admin click cannot accidentally issue a duplicate refund.
export async function requestPaymobRefund(orderId, transactionId, amountCents) {
  if (!process.env.PAYMOB_API_KEY) {
    const needsSetup = await Order.findOneAndUpdate({
      _id: orderId,
      status: 'cancelled',
      paymentMethod: 'paymob',
      paymentStatus: 'paid',
      paymobTransactionId: String(transactionId),
      $or: [
        { refundStatus: { $in: ['not_required', 'failed'] } },
        { refundStatus: { $exists: false } },
      ],
    }, {
      $set: {
        refundStatus: 'failed',
        refundAmount: Number(amountCents),
        refundRequestedAt: new Date(),
        refundError: 'Automatic refund is paused because PAYMOB_API_KEY is missing; configure the merchant API key and retry the refund.',
      },
    }, { new: true });
    return needsSetup || Order.findById(orderId);
  }

  // Verify that this transaction really paid this order before asking Paymob to refund it.
  // In particular, never let an untrusted callback transaction ID become a refund target.
  const order = await Order.findOne({
    _id: orderId,
    status: 'cancelled',
    paymentMethod: 'paymob',
    paymentStatus: 'paid',
    paymobTransactionId: String(transactionId),
  });
  if (!order) return Order.findById(orderId);

  let transaction;
  try {
    transaction = await inquireTransactionById(transactionId);
  } catch {
    transaction = null;
  }
  const savedPaymobOrderIds = [ ...(order.paymobOrderIds || []), order.paymobOrderId ].filter(Boolean).map(String);
  const verifiedAmount = Number(transaction?.amount_cents);
  const refundAmount = Number(amountCents);
  const verified = transaction
    && String(transaction.id) === String(transactionId)
    && transaction.success === true
    && transaction.pending !== true
    && transaction.is_voided !== true
    && transaction.is_refunded !== true
    && savedPaymobOrderIds.includes(String(transaction.order?.id ?? ''))
    && Number.isSafeInteger(verifiedAmount)
    && Number.isSafeInteger(refundAmount)
    && refundAmount > 0
    && verifiedAmount >= refundAmount;
  if (!verified) {
    return await Order.findOneAndUpdate({
      _id: orderId,
      status: 'cancelled',
      paymentMethod: 'paymob',
      paymentStatus: 'paid',
      paymobTransactionId: String(transactionId),
      $or: [ { refundStatus: { $in: ['not_required', 'failed'] } }, { refundStatus: { $exists: false } } ],
    }, {
      $set: {
        refundStatus: 'failed',
      refundAmount,
        refundRequestedAt: new Date(),
        refundError: 'Paymob could not verify that this transaction belongs to this order. No refund was sent; verify the transaction in Paymob.',
      },
    }, { new: true }) || Order.findById(orderId);
  }

  const claimedOrder = await Order.findOneAndUpdate({
    _id: orderId,
    status: 'cancelled',
    paymentMethod: 'paymob',
    paymentStatus: 'paid',
    paymobTransactionId: String(transactionId),
    $or: [
      { refundStatus: { $in: ['not_required', 'failed'] } },
      { refundStatus: { $exists: false } },
    ],
  }, {
    $set: {
      refundStatus: 'processing',
      refundAmount: Number(amountCents),
      refundRequestedAt: new Date(),
    },
    $unset: { refundError: 1 },
  }, { new: true });

  if (!claimedOrder) return Order.findById(orderId);

  try {
    const result = await refundTransaction(transactionId, amountCents);
    const refundId = result.id ?? result.refund_id ?? result.transaction?.id;
    if (refundId == null) return Order.findById(orderId);
    return await Order.findOneAndUpdate(
      { _id: orderId, refundStatus: 'processing' },
      { paymobRefundTransactionId: String(refundId) },
      { new: true },
    ) || Order.findById(orderId);
  } catch (error) {
    if (!error.ambiguous) {
      return await Order.findOneAndUpdate(
        { _id: orderId, refundStatus: 'processing' },
        { refundStatus: 'failed', refundError: String(error.message || 'Paymob rejected the refund').slice(0, 300) },
        { new: true },
      ) || Order.findById(orderId);
    }
    console.error(`Paymob refund status is uncertain for order ${orderId}:`, error.message);
    return Order.findById(orderId);
  }
}

export async function recordPaymobRefund(order, obj) {
  if (!order || order.status !== 'cancelled' || order.refundStatus === 'refunded' || !process.env.PAYMOB_API_KEY) return null;
  const transaction = await inquireTransactionById(order.paymobTransactionId);
  if (!transaction || String(transaction.id) !== String(order.paymobTransactionId)) return null;
  const refundedAmount = Number(transaction?.refunded_amount_cents);
  const requestedAmount = Number(order.refundAmount || order.total);
  if (!Number.isFinite(refundedAmount) || refundedAmount < requestedAmount) return null;
  const refunded = await Order.findOneAndUpdate({
    _id: order._id,
    status: 'cancelled',
    $or: [
      { refundStatus: { $in: ['processing', 'not_required', 'manual_required'] } },
      { refundStatus: { $exists: false } },
    ],
  }, {
    $set: {
      refundStatus: 'refunded',
      refundAmount: refundedAmount,
      refundedAt: new Date(),
      ...(obj.id != null && String(obj.id) !== String(order.paymobTransactionId)
        ? { paymobRefundTransactionId: String(obj.id) }
        : {}),
    },
    $unset: { refundError: 1 },
  }, { new: true });
  return refunded;
}

export async function reconcilePaymobRefund(order) {
  if (!order || order.refundStatus !== 'processing' || !order.paymobTransactionId || !process.env.PAYMOB_API_KEY) return null;
  return recordPaymobRefund(order, {});
}
