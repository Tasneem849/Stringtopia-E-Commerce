import User from './models/User.js';
import Order from './models/Order.js';

export const ACCOUNT_DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const COMPLETED_ORDER_STATUSES = ['shipped', 'declined', 'cancelled', 'expired'];
const OPEN_REFUND_STATUSES = ['processing', 'failed', 'manual_required'];

const personalOrderFields = {
  email: 'deleted-customer@account.invalid',
  'customer.name': 'Deleted customer',
  'customer.phone': '',
  'delivery.recipientName': '',
  'delivery.phone': '',
  'delivery.address.line1': '',
  'delivery.address.line2': '',
  'delivery.address.city': '',
  'delivery.address.postalCode': '',
  'delivery.address.country': '',
  'delivery.giftMessage': '',
  note: '',
  declineReason: '',
  cancellationReason: '',
  accountDeletionDataPending: false,
};

async function anonymizeOrders(filter) {
  return Order.updateMany(filter, {
    $set: personalOrderFields,
    $unset: { user: '', checkoutIpHash: '' },
  });
}

async function anonymizeEligibleDetachedOrders() {
  return anonymizeOrders({
    accountDeletionDataPending: true,
    status: { $in: COMPLETED_ORDER_STATUSES },
    refundStatus: { $nin: OPEN_REFUND_STATUSES },
  });
}

// The finalizer can safely be retried after a process restart because its order updates are idempotent.
export async function finalizeAccountDeletion(userId, now = new Date()) {
  let user = await User.findOneAndUpdate({
    _id: userId,
    role: 'customer',
    deletionScheduledFor: { $lte: now },
    deletionFinalizingAt: { $exists: false },
  }, { $set: { deletionFinalizingAt: now } }, { new: true }).select('_id deletionFinalizingAt').lean();

  if (!user) {
    user = await User.findOne({
      _id: userId,
      role: 'customer',
      deletionScheduledFor: { $lte: now },
      deletionFinalizingAt: { $exists: true },
    }).select('_id deletionFinalizingAt').lean();
  }
  if (!user) return false;

  try {
    const safeToAnonymize = {
      user: user._id,
      status: { $in: COMPLETED_ORDER_STATUSES },
      refundStatus: { $nin: OPEN_REFUND_STATUSES },
    };
    await anonymizeOrders(safeToAnonymize);

    // Keep customer details only while an order still needs fulfillment or refund follow-up.
    await Order.updateMany({ user: user._id }, {
      $unset: { user: '' },
      $set: { accountDeletionDataPending: true },
    });

    await User.deleteOne({ _id: user._id, deletionFinalizingAt: user.deletionFinalizingAt });
    await anonymizeEligibleDetachedOrders();
    return true;
  } catch (error) {
    await User.updateOne(
      { _id: user._id, deletionFinalizingAt: user.deletionFinalizingAt },
      { $unset: { deletionFinalizingAt: '' } },
    ).catch(() => {});
    throw error;
  }
}

export async function sweepAccountDeletions() {
  const now = new Date();
  const dueAccounts = await User.find({
    role: 'customer',
    deletionScheduledFor: { $lte: now },
  }).select('_id').limit(100).lean();

  for (const user of dueAccounts) await finalizeAccountDeletion(user._id, now);
  await anonymizeEligibleDetachedOrders();
}
