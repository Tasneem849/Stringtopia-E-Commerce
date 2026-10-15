'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CheckoutSteps from '@/components/CheckoutSteps';
import ContactFields from '@/components/ContactFields';
import DeliveryForm from '@/components/DeliveryForm';
import { cartLineKey, useStore } from '@/components/Providers';
import { api, effectivePrice, money } from '@/lib/api';
import ProductPrice from '@/components/ProductPrice';

export default function Checkout() {
  const { cart, config, token, ready, clearCart } = useStore();
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [delivery, setDelivery] = useState({ method: 'delivery' });
  const [paymentMethod, setPaymentMethod] = useState('paymob');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState(null);
  const cartSubtotal = cart.reduce((sum, item) => sum + effectivePrice(item) * item.qty, 0);
  const cartKey = cart.map((item) => [cartLineKey(item), item.qty].join(':')).join('|') + ':' + cartSubtotal;
  const needsVariant = cart.some((item) => item.variants?.length && !item.variants.includes(item.variant));
  const currentPromo = appliedPromo?.cartKey === cartKey ? appliedPromo : null;
  const subtotal = currentPromo?.subtotal ?? cartSubtotal;
  const discountAmount = currentPromo?.discountAmount || 0;
  const deliveryFee = delivery.method === 'pickup' ? 0 : Number(config.deliveryFee) || 0;
  const total = subtotal - discountAmount + deliveryFee;

  useEffect(() => {
    setAppliedPromo(null);
    setPromoFeedback(null);
  }, [cartKey]);

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code || promoBusy || busy || !cart.length || needsVariant) {
      if (!code) setPromoFeedback({ type: 'error', text: 'Enter a promo code first.' });
      else if (needsVariant) setPromoFeedback({ type: 'error', text: 'Choose each product option in your cart first.' });
      return;
    }
    setPromoBusy(true);
    setPromoFeedback(null);
    try {
      const result = await api('/orders/promo/validate', {
        method: 'POST',
        body: { code, items: cart.map(({ productId, qty, variant }) => ({ productId, qty, ...(variant ? { variant } : {}) })) },
      });
      setAppliedPromo({ ...result, cartKey });
      setPromoInput(result.code);
      setPromoFeedback({ type: 'success', text: result.code + ' applied — you save ' + money(result.discountAmount) + '.' });
    } catch (promoError) {
      setAppliedPromo(null);
      setPromoFeedback({ type: 'error', text: promoError.message || 'That promo code could not be applied.' });
    } finally {
      setPromoBusy(false);
    }
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (busy || promoBusy || !cart.length || needsVariant) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/orders/checkout', {
        token,
        method: 'POST',
        body: {
          items: cart.map(({ productId, qty, variant }) => ({ productId, qty, ...(variant ? { variant } : {}) })),
          delivery,
          customer,
          paymentMethod,
          promoCode: currentPromo?.code,
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
              <li className="checkout-summary-item" key={cartLineKey(item)}>
                <span><strong>{item.name}</strong>{item.variant && <small className="font-semibold text-rose-900">Selected {item.variantLabel || 'option'}: {item.variant}</small>}<small>Qty {item.qty} × <ProductPrice product={item} /></small></span>
                <strong>{money(effectivePrice(item) * item.qty)}</strong>
              </li>
            ))}
          </ul>
          <div className="checkout-promo" aria-labelledby="checkout-promo-title">
            <div className="checkout-promo-heading">
              <div>
                <h3 id="checkout-promo-title">A little something extra</h3>
                <p>Have a promo code? Add it before placing your order.</p>
              </div>
              <span aria-hidden="true">✦</span>
            </div>
            <div className="checkout-promo-controls">
              <label className="sr-only" htmlFor="checkout-promo-code">Promo code</label>
              <input
                id="checkout-promo-code"
                className="field"
                value={promoInput}
                onChange={(event) => {
                  const nextCode = event.target.value.toUpperCase();
                  setPromoInput(nextCode);
                  if (appliedPromo && nextCode.trim() !== appliedPromo.code) setAppliedPromo(null);
                  setPromoFeedback(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyPromo();
                  }
                }}
                maxLength={24}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="e.g. LOVELY10"
                aria-describedby="checkout-promo-hint"
              />
              {currentPromo ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={promoBusy || busy}
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                    setPromoFeedback(null);
                  }}
                >
                  Remove
                </button>
              ) : (
                <button type="button" className="btn btn-mint" disabled={promoBusy || busy} onClick={applyPromo}>
                  {promoBusy ? 'Checking…' : 'Apply code'}
                </button>
              )}
            </div>
            <p id="checkout-promo-hint" className="checkout-promo-hint">Promo discounts apply to your items before delivery.</p>
            {promoFeedback && (
              <p
                className={'checkout-promo-feedback checkout-promo-feedback-' + promoFeedback.type}
                role={promoFeedback.type === 'error' ? 'alert' : 'status'}
              >
                {promoFeedback.text}
              </p>
            )}
          </div>
          <div className="checkout-summary-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {discountAmount > 0 && <div className="checkout-summary-row"><span>Promo ({currentPromo.code})</span><span>-{money(discountAmount)}</span></div>}
          <div className="checkout-summary-row"><span>Delivery</span><span>{deliveryFee ? money(deliveryFee) : 'Free'}</span></div>
          <div className="checkout-summary-row checkout-summary-total"><strong>Total</strong><strong>{money(total)}</strong></div>
          <p className="checkout-summary-note">
            {paymentMethod === 'cod'
              ? 'Cash is collected when your order arrives or is picked up.'
              : paymentMethod === 'instapay'
                ? 'We will hold your items while we confirm your InstaPay transfer.'
                : delivery.method === 'pickup' ? 'Pickup has no delivery fee.' : 'Delivery fee is confirmed with your order.'}
          </p>
          {needsVariant && <p className="checkout-error" role="alert">Choose each product’s option in your cart before placing the order. <Link href="/cart" className="underline">Return to cart</Link>.</p>}
          {error && <p className="checkout-error" role="alert">{error}</p>}
          <p className="mb-2 text-center text-xs leading-relaxed text-stone-600">
            Your details are handled as described in our <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link>. Orders are subject to our <Link href="/terms" className="underline underline-offset-2">Terms of sale</Link>.
          </p>
          <button type="submit" className="btn btn-primary checkout-submit" disabled={busy || promoBusy || needsVariant || (paymentMethod === 'instapay' && !config.instaPayAddress)}>
            {busy ? (paymentMethod === 'paymob' ? 'Preparing Paymob checkout…' : 'Placing your order…') : paymentMethod === 'paymob' ? 'Continue to Paymob' : 'Place order'} <span aria-hidden="true">→</span>
          </button>
          <p className="checkout-guest-note">Guest checkout is welcome. No account needed.</p>
        </aside>
      </form>
    </section>
  );
}
