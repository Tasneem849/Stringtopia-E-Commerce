'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';
import AdminOrder from '@/components/AdminOrder';

const STATUSES = ['pending', 'out_for_delivery', 'paid', 'shipped', 'approved', 'requested', 'declined', 'cancelled', 'expired'];

export default function AdminOrders() {
  const { token } = useStore();
  const [status, setStatus] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const load = () => api(`/admin/orders?status=${status}&page=${page}&limit=20`, { token }).then((result) => {
    setOrders(result.orders);
    setPage(result.page);
    setPages(result.pages);
    setTotal(result.total);
  }).catch((e) => setErr(e.message));
  useEffect(() => { if (token) load(); }, [token, status, page]);

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
          onChange={(e) => { setOrders(null); setPage(1); setStatus(e.target.value); }}
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
            <>
              {order.delivery?.method === 'delivery' && <button onClick={() => orderAction(order._id, 'out-for-delivery')} className="btn btn-ghost">Mark out for delivery</button>}
              <button onClick={() => orderAction(order._id, 'complete-cod')} className="btn btn-primary">
                {order.delivery?.method === 'pickup' ? 'Mark collected & cash received' : 'Mark delivered & cash received'}
              </button>
            </>
          )}
          {order.status === 'out_for_delivery' && order.paymentMethod === 'cod' && <button onClick={() => orderAction(order._id, 'complete-cod')} className="btn btn-primary">Mark delivered & cash received</button>}
          {['requested', 'approved'].includes(order.status) || (order.status === 'pending' && ['instapay', 'cod'].includes(order.paymentMethod)) ? <button onClick={() => orderAction(order._id, 'cancel')} className="btn btn-ghost text-red-700">Cancel order</button> : null}
          {order.status === 'paid' && (
            <button onClick={() => orderAction(order._id, 'ship')} className="btn btn-primary">
              {order.delivery?.method === 'pickup' ? 'Mark ready for pickup' : 'Mark shipped'}
            </button>
          )}
        </AdminOrder>
      ))}
      {orders?.length > 0 && <div className="flex items-center justify-center gap-4 text-sm">
        <button type="button" className="cursor-pointer underline disabled:cursor-not-allowed disabled:text-stone-400" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button>
        <span>Page {page} of {pages} · {total} orders</span>
        <button type="button" className="cursor-pointer underline disabled:cursor-not-allowed disabled:text-stone-400" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next →</button>
      </div>}
    </div>
  );
}
