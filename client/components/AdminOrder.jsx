import { money } from '@/lib/api';

// One order with everything the seller needs to act on it. Action buttons go in as children.
export default function AdminOrder({ o, children }) {
  const d = o.delivery || {};
  const a = d.address || {};
  return (
    <div className="space-y-1 card text-sm">
      <div className="flex justify-between">
        <strong className="capitalize">{o.status === 'out_for_delivery' ? 'Out for delivery' : o.status}</strong>
        <span className="text-stone-500">{new Date(o.createdAt).toLocaleString()}</span>
      </div>
      <p>{o.user ? `${o.user.name} (${o.user.email})` : o.customer?.name || `Guest ${o.email || ''}`}{o.customer?.phone ? `, ${o.customer.phone}` : ''}</p>
      {o.orderSource && o.orderSource !== 'website' && <p><strong>Source:</strong> {o.orderSource === 'whatsapp' ? 'WhatsApp' : 'Phone order'}</p>}
      <p><strong>Payment:</strong> {o.paymentMethod === 'cod' ? 'Cash on Delivery' : o.paymentMethod === 'cash' ? 'Cash' : o.paymentMethod === 'instapay' ? 'InstaPay' : 'Paymob'}{o.paymentStatus === 'awaiting_confirmation' ? ' · awaiting confirmation' : o.paymentStatus === 'unpaid' ? ' · unpaid' : o.paymentStatus === 'paid' ? ' · paid' : ''}</p>
      {o.refundStatus && o.refundStatus !== 'not_required' && <p className={o.refundStatus === 'failed' || o.refundStatus === 'manual_required' ? 'font-medium text-red-700' : 'font-medium text-emerald-700'}>
        <strong>Refund:</strong>{' '}
        {o.refundStatus === 'processing' ? `Full refund ${money(o.refundAmount || o.total)} submitted to Paymob; processing` :
          o.refundStatus === 'refunded' ? `Full refund ${money(o.refundAmount || o.total)} confirmed${o.refundedAt ? ` · ${new Date(o.refundedAt).toLocaleString()}` : ''}` :
            o.refundStatus === 'manual_required' ? `Manual full refund required · ${money(o.refundAmount || o.total)}` :
              `Automatic refund failed${o.refundError ? ` · ${o.refundError}` : ''}`}
      </p>}
      {o.instaPayReference && <p><strong>InstaPay transfer reference:</strong> {o.instaPayReference}</p>}
      {o.items.map((i) => <p key={i._id}>{i.qty} × {i.name}</p>)}
      {o.promoCode && o.discountAmount > 0 && <p><strong>Promo {o.promoCode}:</strong> saved {money(o.discountAmount)}</p>}
      <p className="font-medium">
        {money(o.total)}{o.shippingFee ? ` (includes ${money(o.shippingFee)} delivery)` : ''}
      </p>
      {d.method === 'pickup' && <p>📍 Customer picks up</p>}
      {d.method === 'delivery' && (
        <p>
          {d.gift ? '🎁 Gift for' : '🚚 Deliver to'} {d.recipientName}, {d.phone}
          <br />
          {[a.line1, a.line2, a.city, a.postalCode, a.country].filter(Boolean).join(', ')}
        </p>
      )}
      {d.giftMessage && <p>Card message: {d.giftMessage}</p>}
      {o.note && <p>Customer note: {o.note}</p>}
      {children}
    </div>
  );
}
