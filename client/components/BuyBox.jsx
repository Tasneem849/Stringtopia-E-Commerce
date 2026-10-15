'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from './Providers';
import DeliveryForm from './DeliveryForm';
import ContactFields from './ContactFields';

// Enough stock -> "Add to cart" (guests welcome). Not enough -> reservation request, which needs an account:
// guests create one right here (email + password) and the request is sent in the same step.
export default function BuyBox({ product: p }) {
  const { token, login, addToCart } = useStore();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(p.variants?.length === 1 ? p.variants[0] : '');
  const [note, setNote] = useState('');
  const [creds, setCreds] = useState({ email: '', password: '' });
  const [mode, setMode] = useState('register');
  const [msg, setMsg] = useState('');
  const [delivery, setDelivery] = useState(null);
  const [customer, setCustomer] = useState(null);
  const field = (k) => ({ value: creds[k], onChange: (e) => setCreds({ ...creds, [k]: e.target.value }) });

  function buyNow() {
    if (!addToCart(p, qty, variant)) {
      setMsg(p.variants?.length && !variant ? `Choose ${p.variantLabel || 'an option'} first.` : 'There is not enough stock to add that quantity.');
      return;
    }
    router.push('/checkout');
  }

  async function reserve(e) {
    e.preventDefault();
    if (p.variants?.length && !variant) {
      setMsg(`Choose ${p.variantLabel || 'an option'} first.`);
      return;
    }
    try {
      let t = token;
      if (!t) {
        const session = await api(`/auth/${mode}`, { method: 'POST', body: creds });
        t = login(session).token;
      }
      await api('/orders/reserve', { token: t, method: 'POST', body: { items: [{ productId: p._id, qty, ...(variant ? { variant } : {}) }], note, delivery, customer } });
      router.push('/orders');
    } catch (err) {
      setMsg(err.message);
    }
  }

  const input = 'field w-full';
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">{p.stock > 0 ? `${p.stock} in stock` : 'Sold out'}</p>
      {p.variants?.length > 0 && <label className="block max-w-sm space-y-1 text-sm font-medium">
        {p.variantLabel || 'Choose an option'}
        <select required className="field w-full" value={variant} onChange={(event) => { setVariant(event.target.value); setMsg(''); }}>
          <option value="">Choose {p.variantLabel || 'an option'}</option>
          {p.variants.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      </label>}
      <input
        type="number" min={1} max={20} value={qty} className="field w-20"
        onChange={(e) => setQty(Math.max(1, Math.min(20, +e.target.value || 1)))}
      />
      {qty <= p.stock ? (
        <div className="inline-flex flex-wrap items-center gap-3 ml-3">
          <button type="button" disabled={p.variants?.length > 0 && !variant} onClick={() => { setMsg(addToCart(p, qty, variant) ? 'Added to cart' : 'There is not enough stock to add that quantity.'); }} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            Add to cart
          </button>
          <button type="button" onClick={buyNow} className="btn btn-ghost text-sm px-4 py-2">
            Buy now
          </button>
        </div>
      ) : (
        <form onSubmit={reserve} className="card space-y-2 bg-sun/25 text-sm">
          <p>
            {p.stock > 0 ? `Only ${p.stock} in stock.` : 'Currently sold out.'} Request a reservation and we'll
            tell you if we can make it. You only pay once we approve.
          </p>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder="Anything we should know? (colors, deadline...)" className={input}
          />
          <ContactFields askEmail={false} onChange={setCustomer} />
          <DeliveryForm onChange={setDelivery} />
          {!token && (
            <>
              <p className="font-medium">
                {mode === 'register' ? 'Create your account to track this request:' : 'Log in to send this request:'}
              </p>
              <input type="email" required placeholder="Email" autoComplete="email" {...field('email')} className={input} />
              <input
                type="password" required minLength={8} placeholder="Password (8+ characters)"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'} {...field('password')} className={input}
              />
              <button type="button" className="cursor-pointer underline" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
                {mode === 'register' ? 'Already have an account? Log in' : 'New here? Create an account'}
              </button>
            </>
          )}
          <div>
            <button className="btn btn-primary">Request to reserve {qty}</button>
            {p.stock > 0 && (
              <button
                type="button" className="btn btn-ghost ml-2"
                disabled={p.variants?.length > 0 && !variant}
                onClick={() => { setMsg(addToCart(p, p.stock, variant) ? `Added the ${p.stock} in stock to your cart` : 'There is not enough stock to add that quantity.'); }}
              >
                Just buy the {p.stock} in stock
              </button>
            )}
          </div>
        </form>
      )}
      {msg && <p className="text-sm text-stone-600">{msg}</p>}
    </div>
  );
}
