'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';
import AdminOrder from '@/components/AdminOrder';

const STATUSES = ['pending', 'paid', 'shipped', 'approved', 'requested', 'declined', 'cancelled', 'expired'];

export default function AdminOrders() {
  const { token } = useStore();
  const [status, setStatus] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api(`/admin/orders?status=${status}`, { token }).then(setOrders).catch((e) => setErr(e.message));
  useEffect(() => { if (token) load(); }, [token, status]);

  async function orderAction(id, action) {
    await api(`/admin/orders/${id}/${action}`, { token, method: 'PATCH' }).catch((e) => setErr(e.message));
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
          {STATUSES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      {!orders ? <p>Loading...</p> : !orders.length ? <p>Nothing here.</p> : orders.map((order) => (
        <AdminOrder key={order._id} o={order}>
          {order.status === 'pending' && order.paymentMethod === 'instapay' && order.paymentStatus === 'awaiting_confirmation' && (
            <button onClick={() => orderAction(order._id, 'confirm-payment')} className="btn btn-primary">Confirm InstaPay payment</button>
          )}
          {order.status === 'pending' && order.paymentMethod === 'cod' && (
            <button onClick={() => orderAction(order._id, 'complete-cod')} className="btn btn-primary">
              {order.delivery?.method === 'pickup' ? 'Mark collected & cash received' : 'Mark delivered & cash received'}
            </button>
          )}
          {order.status === 'paid' && (
            <button onClick={() => orderAction(order._id, 'ship')} className="btn btn-primary">
              {order.delivery?.method === 'pickup' ? 'Mark ready for pickup' : 'Mark shipped'}
            </button>
          )}
        </AdminOrder>
      ))}
    </div>
  );
}
