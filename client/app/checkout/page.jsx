'use client';

import { useState } from 'react';
import Link from 'next/link';
import CheckoutSteps from '@/components/CheckoutSteps';
import ContactFields from '@/components/ContactFields';
import DeliveryForm from '@/components/DeliveryForm';
import { useStore } from '@/components/Providers';
import { api, money } from '@/lib/api';

export default function Checkout() {
  const { cart, config, token, ready, clearCart } = useStore();
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [delivery, setDelivery] = useState({ method: 'delivery' });
  const [paymentMethod, setPaymentMethod] = useState('paymob');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = delivery.method === 'pickup' ? 0 : Number(config.deliveryFee) || 0;
  const total = subtotal + deliveryFee;

  async function placeOrder(event) {
    event.preventDefault();
    if (busy || !cart.length) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/orders/checkout', {
        token,
        method: 'POST',
        body: {
          items: cart.map(({ productId, qty }) => ({ productId, qty })),
          delivery,
          customer,
          paymentMethod,
        },
      });
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      if (!result.publicToken) throw new Error('We could not confirm your order. Please try again.');
      clearCart();
      window.location.assign(`/thanks?ref=${encodeURIComponent(result.publicToken)}`);
    } catch (checkoutError) {
      setError(checkoutError.message || 'We could not place your order. Please try again.');
      setBusy(false);
    }
  }

  if (!ready) return <p role="status">Loading checkout…</p>;

  if (!cart.length) {
    return (
      <section className="checkout-empty card" aria-labelledby="checkout-empty-title">
        <CheckoutSteps current="checkout" />
        <p className="empty-cart-kicker">Nothing to check out yet</p>
        <h1 id="checkout-empty-title" className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-stone-600">Add a handmade favorite before entering delivery details.</p>
        <div className="checkout-empty-actions">
          <Link href="/cart" className="btn btn-ghost">Back to cart</Link>
          <Link href="/" className="btn btn-primary">Browse the shop</Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="checkout-title">
      <CheckoutSteps current="checkout" />
      <div className="checkout-page-heading">
        <div>
          <p className="empty-cart-kicker">Almost yours</p>
          <h1 id="checkout-title" className="text-3xl font-bold">Address &amp; payment</h1>
          <p className="mt-1 text-stone-600">Tell us where to send your handmade picks.</p>
        </div>
        <Link href="/cart" className="btn btn-ghost">← Back to cart</Link>
      </div>

      <form className="checkout-layout" onSubmit={placeOrder}>
        <div className="checkout-form-fields">
          <ContactFields onChange={setCustomer} />
          <DeliveryForm onChange={setDelivery} />
          <fieldset className="checkout-payment-methods card">
            <legend className="font-semibold">Choose how to pay</legend>
            <label className={`checkout-payment-option${paymentMethod === 'cod' ? ' checkout-payment-option-selected' : ''}`}>
              <input type="radio" name="paymentMethod" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <span className="checkout-payment-option-copy">
                <strong>Cash on Delivery</strong>
                <span>{delivery.method === 'pickup' ? 'Pay in cash when you collect your order.' : 'Pay in cash when your order arrives.'}</span>
              </span>
            </label>
            <label className={`checkout-payment-option${paymentMethod === 'instapay' ? ' checkout-payment-option-selected' : ''}${!config.instaPayAddress ? ' checkout-payment-option-disabled' : ''}`}>
              <input type="radio" name="paymentMethod" value="instapay" checked={paymentMethod === 'instapay'} disabled={!config.instaPayAddress} onChange={() => setPaymentMethod('instapay')} />
              <span className="checkout-payment-option-copy checkout-insta-payment-copy">
                <span className="checkout-insta-payment-heading">
                  <strong>InstaPay</strong>
                  <span className="checkout-insta-badge">Manual bank transfer</span>
                </span>
                {config.instaPayAddress ? (
                  <>
                    <span className="checkout-insta-caption">Transfer the order total to the account below. We will confirm your order after verifying the payment.</span>
                    <span className="checkout-insta-recipient">
                      <span><small>Recipient</small><strong>{config.instaPayAccountName || 'Stringtopia'}</strong></span>
                      <span><small>InstaPay address</small><strong>{config.instaPayAddress}</strong></span>
                    </span>
                    <span className="checkout-insta-note">After placing your order, choose to submit the transfer reference or send a payment screenshot via WhatsApp.</span>
                  </>
                ) : (
                  <span className="checkout-insta-caption">InstaPay is temporarily unavailable. Please select another payment method.</span>
                )}
              </span>
            </label>
            <label className={`checkout-payment-option${paymentMethod === 'paymob' ? ' checkout-payment-option-selected' : ''}`}>
              <input type="radio" name="paymentMethod" value="paymob" checked={paymentMethod === 'paymob'} onChange={() => setPaymentMethod('paymob')} />
              <span className="checkout-payment-option-copy">
                <strong>Paymob</strong>
                <span>Pay online on Paymob’s secure checkout page.</span>
              </span>
            </label>
          </fieldset>
        </div>

        <aside className="checkout-summary card" aria-labelledby="checkout-summary-title">
          <h2 id="checkout-summary-title" className="text-xl font-bold">Your order</h2>
          <ul className="checkout-summary-items">
            {cart.map((item) => (
              <li className="checkout-summary-item" key={item.productId}>
                <span><strong>{item.name}</strong><small>Qty {item.qty} × {money(item.price)}</small></span>
                <strong>{money(item.price * item.qty)}</strong>
              </li>
            ))}
          </ul>
          <div className="checkout-summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="checkout-summary-row"><span>Delivery</span><span>{deliveryFee ? money(deliveryFee) : 'Free'}</span></div>
          <div className="checkout-summary-row checkout-summary-total"><strong>Total</strong><strong>{money(total)}</strong></div>
          <p className="checkout-summary-note">
            {paymentMethod === 'cod'
              ? 'Cash is collected when your order arrives or is picked up.'
              : paymentMethod === 'instapay'
                ? 'We will hold your items while we confirm your InstaPay transfer.'
                : delivery.method === 'pickup' ? 'Pickup has no delivery fee.' : 'Delivery fee is confirmed with your order.'}
          </p>
          {error && <p className="checkout-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary checkout-submit" disabled={busy || (paymentMethod === 'instapay' && !config.instaPayAddress)}>
            {busy ? (paymentMethod === 'paymob' ? 'Preparing Paymob checkout…' : 'Placing your order…') : paymentMethod === 'paymob' ? 'Continue to Paymob' : 'Place order'} <span aria-hidden="true">→</span>
          </button>
          <p className="checkout-guest-note">Guest checkout is welcome. No account needed.</p>
        </aside>
      </form>
    </section>
  );
}
