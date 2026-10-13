'use client';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';

const LABEL = {
  requested: 'Waiting for approval', approved: 'Approved: ready to pay', pending: 'Awaiting payment',
  paid: 'Paid', shipped: 'Shipped', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired',
};

export default function Orders() {
  const { token, ready } = useStore();
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/orders/mine', { token }).then(setOrders).catch((e) => setErr(e.message));

  useEffect(() => {
    if (!ready) return;
    if (!token) { window.location.href = '/login'; return; }
    load();
  }, [ready, token]);

  async function cancel(id) {
    await api(`/orders/${id}/cancel`, { token, method: 'POST' }).catch((e) => setErr(e.message));
    load();
  }

  if (!orders) return <p>{err || 'Loading...'}</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">My orders</h1>
      {err && <p className="text-red-700">{err}</p>}
      {!orders.length && <p>No orders yet.</p>}
      {orders.map((o) => (
        <div key={o._id} className="space-y-1 card">
          <div className="flex justify-between">
            <strong>{o.delivery?.method === 'pickup' && o.status === 'shipped' ? 'Ready for pickup' : LABEL[o.status]}</strong>
            <span className="text-sm text-stone-500">{new Date(o.createdAt).toLocaleDateString()}</span>
          </div>
          {o.items.map((i) => <p key={i._id} className="text-sm">{i.qty} × {i.name}</p>)}
          {o.delivery?.method && (
            <p className="text-sm text-stone-600">
              {o.delivery.method === 'pickup'
                ? 'Pick up from us (free)'
                : `${o.delivery.gift ? 'Gift for' : 'Deliver to'} ${o.delivery.recipientName}, ${o.delivery.address?.city}`}
            </p>
          )}
          <p className="font-medium">{money(o.total)}</p>
          {o.eta && <p className="text-sm">Estimate: {o.eta}</p>}
          {o.declineReason && <p className="text-sm">Reason: {o.declineReason}</p>}
          {['approved', 'pending'].includes(o.status) && (
            <p className="text-sm">
              {o.expiresAt && `Pay by ${new Date(o.expiresAt).toLocaleString()}: `}
              <a href={`/pay/${o.publicToken}`} className="font-semibold text-yarn underline">Pay now</a>
            </p>
          )}
          {['requested', 'pending', 'approved'].includes(o.status) && (
            <button onClick={() => cancel(o._id)} className="text-sm text-red-700 underline">Cancel</button>
          )}
        </div>
      ))}
    </div>
  );
}
