'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';
import AdminOrder from '@/components/AdminOrder';

const STATUSES = ['paid', 'shipped', 'approved', 'requested', 'pending', 'declined', 'cancelled', 'expired'];

export default function AdminOrders() {
  const { token } = useStore();
  const [status, setStatus] = useState('paid'); // paid = needs action
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api(`/orders?status=${status}`, { token }).then(setOrders).catch((e) => setErr(e.message));
  useEffect(() => { if (token) load(); }, [token, status]);

  async function ship(id) {
    await api(`/orders/${id}/ship`, { token, method: 'PATCH' }).catch((e) => setErr(e.message));
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <select
          value={status} className="field capitalize"
          onChange={(e) => { setOrders(null); setStatus(e.target.value); }}
        >
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      {!orders ? <p>Loading...</p> : !orders.length ? <p>Nothing here.</p> : orders.map((o) => (
        <AdminOrder key={o._id} o={o}>
          {o.status === 'paid' && (
            <button onClick={() => ship(o._id)} className="btn btn-primary">
              {o.delivery?.method === 'pickup' ? 'Mark ready for pickup' : 'Mark shipped'}
            </button>
          )}
        </AdminOrder>
      ))}
    </div>
  );
}
