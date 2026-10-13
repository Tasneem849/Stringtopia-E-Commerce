'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';
import AdminOrder from '@/components/AdminOrder';

// Reservation inbox: approve (customer gets a payment link) or decline (optional reason).
export default function Requests() {
  const { token } = useStore();
  const [orders, setOrders] = useState(null);
  const [text, setText] = useState({});
  const [err, setErr] = useState('');
  const load = () => api('/orders?status=requested', { token }).then(setOrders).catch((e) => setErr(e.message));
  useEffect(() => { if (token) load(); }, [token]);

  async function act(id, action, body) {
    setErr('');
    try {
      await api(`/orders/${id}/${action}`, { token, method: 'POST', body });
    } catch (e) {
      setErr(e.message);
    }
    load();
  }

  if (!orders) return <p>{err || 'Loading...'}</p>;
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Reservation requests ({orders.length})</h1>
      {err && <p className="text-red-700">{err}</p>}
      {!orders.length && <p>No requests waiting.</p>}
      {orders.map((o) => (
        <AdminOrder key={o._id} o={o}>
          <input
            value={text[o._id] || ''} onChange={(e) => setText({ ...text, [o._id]: e.target.value })}
            placeholder="Estimate if approving (e.g. ready in 2 weeks), reason if declining" className="field w-full"
          />
          <div className="flex gap-2">
            <button onClick={() => act(o._id, 'approve', { eta: text[o._id] || undefined })} className="btn btn-mint">
              Approve
            </button>
            <button onClick={() => act(o._id, 'decline', { reason: text[o._id] || undefined })} className="btn btn-danger">
              Decline
            </button>
          </div>
        </AdminOrder>
      ))}
    </div>
  );
}
