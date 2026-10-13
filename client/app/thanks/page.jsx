'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';

// Where Paymob sends people back to. The ref in the address is an unguessable key, so guests can see their
// order here without an account. An order only becomes paid when Paymob's callback reaches the server.
export default function Thanks() {
  const { clearCart, config } = useStore();
  const [order, setOrder] = useState(null);
  const [ref, setRef] = useState('');
  const [failed, setFailed] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const token = q.get('ref');
    if (!token) return setErr('Order not found');
    const bad = q.get('success') === 'false';
    setRef(token);
    setFailed(bad);
    if (!bad) clearCart();
    let tries = 0;
    const load = async () => {
      try {
        const o = await api(`/orders/by-ref/${token}`);
        setOrder(o);
        if (!bad && o.status === 'pending' && ++tries < 10) setTimeout(load, 1500); // the callback can take a moment
      } catch (e) {
        setErr(e.message);
      }
    };
    load();
  }, []);

  if (err) return <p className="text-red-700">{err}</p>;
  if (!order) return <p>Checking your order...</p>;
  const paid = ['paid', 'shipped'].includes(order.status);
  return (
    <div className="card space-y-2">
      <h1 className="text-3xl font-bold">
        {paid ? 'Thank you! 🧶' : failed ? 'The payment did not go through' : 'Confirming your payment...'}
      </h1>
      {order.items.map((i, n) => <p key={n}>{i.qty} × {i.name}</p>)}
      <p className="font-medium">{money(order.total)}</p>
      {paid && order.method === 'pickup' && config.pickupAddress && <p className="text-sm">Pick up at: {config.pickupAddress}</p>}
      {paid && <p className="text-sm text-stone-600">Bookmark this page to check on your order. We also email you a link.</p>}
      {failed && ['pending', 'approved'].includes(order.status) && (
        <Link href={`/pay/${ref}`} className="btn btn-primary">Try paying again</Link>
      )}
      <Link href="/" className="block text-yarn underline">Keep shopping</Link>
    </div>
  );
}
