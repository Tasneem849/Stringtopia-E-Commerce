'use client';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';
import AdminOrder from '@/components/AdminOrder';
import ConfirmDialog from '@/components/ConfirmDialog';

const STATUSES = ['all', 'pending', 'out_for_delivery', 'paid', 'shipped', 'approved', 'requested', 'declined', 'cancelled', 'expired'];
const CANCELLABLE_STATUSES = new Set(['requested', 'pending', 'approved', 'paid', 'out_for_delivery', 'shipped']);

export default function AdminOrders() {
  const { token } = useStore();
  const [status, setStatus] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const load = () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (status !== 'all') query.set('status', status);
    return api(`/admin/orders?${query}`, { token }).then((result) => {
      setOrders(result.orders);
      setPage(result.page);
      setPages(result.pages);
      setTotal(result.total);
    }).catch((e) => setErr(e.message));
  };
  useEffect(() => { if (token) load(); }, [token, status, page]);

  async function orderAction(id, action) {
    await api(`/admin/orders/${id}/${action}`, { token, method: 'PATCH' }).catch((e) => setErr(e.message));
    load();
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError('');
    setErr('');
    try {
      const result = await api(`/admin/orders/${cancelTarget._id}/cancel`, {
        token,
        method: 'PATCH',
        body: cancelTarget.status === 'cancelled' ? undefined : { reason: cancelReason.trim() },
      });
      setCancelTarget(null);
      setCancelReason('');
      if (result.refundStatus === 'failed') setErr(`Order cancelled, but Paymob could not start the refund. Use “Retry full refund” after checking the transaction in Paymob.`);
      await load();
    } catch (error) {
      setCancelError(error.message);
    } finally {
      setCancelBusy(false);
    }
  }

  function cancellationDescription(order) {
    if (order.status === 'cancelled' && order.refundStatus === 'failed') {
      return `The order is already cancelled. Retry the full Paymob refund of ${money(order.refundAmount || order.total)}.`;
    }
    if (order.paymentStatus === 'paid' && order.paymentMethod === 'paymob' && order.paymobTransactionId) {
      return `This will cancel the order and immediately submit a full refund of ${money(order.total)} to Paymob. The bank or payment provider may take time to post the funds.`;
    }
    if (order.paymentStatus === 'paid' || (order.paymentMethod === 'instapay' && order.instaPayReference)) {
      const payment = order.paymentMethod === 'instapay' ? 'InstaPay' : order.paymentMethod === 'cod' ? 'cash-on-delivery' : order.paymentMethod === 'cash' ? 'cash' : 'Paymob';
      const detail = order.paymentStatus === 'paid' ? 'was recorded' : 'has a submitted transfer reference and needs verification';
      return `This will cancel the order. The ${payment} payment ${detail}, so verify the payment and arrange a full refund of ${money(order.refundAmount || order.total)} manually outside the website.`;
    }
    return 'This will cancel the order and release any stock it is holding. No payment is currently marked as received.';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <select
          value={status} className="field capitalize"
          onChange={(e) => { setOrders(null); setPage(1); setStatus(e.target.value); }}
        >
          {STATUSES.map((item) => <option key={item} value={item}>{item === 'all' ? 'All orders' : item}</option>)}
        </select>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      {!orders ? <p>Loading...</p> : !orders.length ? <p>Nothing here.</p> : orders.map((order) => (
        <AdminOrder key={order._id} o={order}>
          {['pending', 'expired'].includes(order.status) && order.paymentMethod === 'instapay' && order.paymentStatus === 'awaiting_confirmation' && (
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
          {order.status === 'pending' && order.paymentMethod === 'cash' && order.paymentStatus === 'unpaid' && (
            <button onClick={() => orderAction(order._id, 'receive-cash')} className="btn btn-primary">Mark cash received</button>
          )}
          {order.status === 'out_for_delivery' && order.paymentMethod === 'cod' && <button onClick={() => orderAction(order._id, 'complete-cod')} className="btn btn-primary">Mark delivered & cash received</button>}
          {CANCELLABLE_STATUSES.has(order.status) && <button onClick={() => { setCancelTarget(order); setCancelReason(''); setCancelError(''); }} className="btn btn-ghost text-red-700">Cancel order</button>}
          {order.status === 'cancelled' && order.refundStatus === 'failed' && <button onClick={() => { setCancelTarget(order); setCancelReason(''); setCancelError(''); }} className="btn btn-ghost text-red-700">Retry full refund</button>}
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
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={cancelTarget?.status === 'cancelled' ? 'Retry the full refund?' : 'Cancel this order?'}
        description={cancelTarget ? cancellationDescription(cancelTarget) : ''}
        confirmLabel={cancelTarget?.status === 'cancelled' ? 'Retry full refund' : 'Cancel order'}
        cancelLabel="Keep order"
        busyLabel={cancelTarget?.status === 'cancelled' ? 'Requesting refund…' : 'Cancelling…'}
        inputLabel={cancelTarget?.status === 'cancelled' ? undefined : 'Cancellation reason (optional)'}
        inputType="textarea"
        inputHint={cancelTarget?.status === 'cancelled' ? undefined : 'This will be included in the customer’s cancellation email. Optional, up to 300 characters.'}
        inputValue={cancelReason}
        inputPlaceholder="Add a short explanation, if helpful"
        inputMaxLength={300}
        onInputChange={setCancelReason}
        busy={cancelBusy}
        error={cancelError}
        onConfirm={confirmCancel}
        onCancel={() => { if (!cancelBusy) { setCancelTarget(null); setCancelReason(''); setCancelError(''); } }}
      />
    </div>
  );
}
