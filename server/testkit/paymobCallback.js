import crypto from 'node:crypto';

// Builds a Paymob "transaction processed" callback and signs it the way Paymob does (HMAC-SHA512 over the
// fields in a fixed order), so tests can play the part of Paymob. Written independently of src/paymob.js.
export function paymobCallback(order, overrides = {}, secret = process.env.PAYMOB_HMAC_SECRET) {
  const obj = {
    amount_cents: order.total, created_at: '2026-10-12T10:00:00.000000', currency: 'EGP', error_occured: false,
    has_parent_transaction: false, id: 1001, integration_id: 111, is_3d_secure: true, is_auth: false, is_capture: false,
    is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: 7, merchant_order_id: `${order.id}-1` },
    owner: 5, pending: false, source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true, ...overrides,
  };
  const signed = [obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction, obj.id,
    obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
    obj.is_voided, obj.order.id, obj.owner, obj.pending, obj.source_data.pan, obj.source_data.sub_type,
    obj.source_data.type, obj.success].join('');
  return { obj, hmac: crypto.createHmac('sha512', secret).update(signed).digest('hex') };
}
