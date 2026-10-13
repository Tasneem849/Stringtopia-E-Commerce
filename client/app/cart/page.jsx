'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';
import DeliveryForm from '@/components/DeliveryForm';
import ContactFields from '@/components/ContactFields';

export default function Cart() {
  const { cart, setQty, removeItem, token, config } = useStore();
  const [delivery, setDelivery] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [err, setErr] = useState('');
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = delivery?.method === 'delivery' ? config.deliveryFee : 0;

  async function checkout(e) {
    e.preventDefault();
    try {
      const items = cart.map(({ productId, qty }) => ({ productId, qty }));
      const { url } = await api('/orders/checkout', { token, method: 'POST', body: { items, delivery, customer } });
      window.location.href = url; // Paymob checkout
    } catch (ex) {
      setErr(ex.message);
    }
  }

  if (!cart.length) {
    return <p>Your cart is empty. <Link href="/" className="text-yarn underline">Browse pieces</Link></p>;
  }
  return (
    <form onSubmit={checkout} className="space-y-3">
      <h1 className="text-2xl font-bold">Your cart</h1>
      {cart.map((i) => (
        <div key={i.productId} className="flex items-center justify-between card">
          <Link href={`/products/${i.slug}`}>
            {i.name}
            <span className="block text-sm text-stone-500">{money(i.price)}</span>
          </Link>
          <div className="flex items-center gap-3">
            <input
              type="number" min={1} max={20} value={i.qty} className="field w-20"
              onChange={(e) => setQty(i.productId, Math.max(1, +e.target.value || 1))}
            />
            <button type="button" onClick={() => removeItem(i.productId)} className="text-sm text-red-700">Remove</button>
          </div>
        </div>
      ))}
      <ContactFields onChange={setCustomer} />
      <DeliveryForm onChange={setDelivery} />
      <div className="text-right">
        <p className="text-sm text-stone-600">Items {money(subtotal)} · Delivery {fee ? money(fee) : 'Free'}</p>
        <p className="text-lg font-semibold">Total {money(subtotal + fee)}</p>
      </div>
      {err && <p className="text-red-700">{err}</p>}
      <button className="btn btn-primary w-full">Checkout</button>
      <p className="text-center text-sm text-stone-500">No account needed</p>
    </form>
  );
}
