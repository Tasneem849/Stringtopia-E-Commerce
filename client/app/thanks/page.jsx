'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';

export default function Thanks() {
  const { clearCart, config } = useStore();
  const [order, setOrder] = useState(null);
  const [ref, setRef] = useState('');
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [proofChoice, setProofChoice] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [referenceSaved, setReferenceSaved] = useState(false);
  const [savingReference, setSavingReference] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const [paymentCheckNotice, setPaymentCheckNotice] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const token = query.get('ref');
    if (!token) return setError('Order not found');
    const paymentFailed = query.get('success') === 'false';
    setRef(token);
    setFailed(paymentFailed);
    if (!paymentFailed) clearCart();
    let active = true;
    let timer;
    let tries = 0;
    const load = async () => {
      try {
        const current = await api(`/orders/by-ref/${token}`);
        if (!active) return;
        setOrder(current);
        setTransferReference(current.instaPayReference || '');
        if (!paymentFailed && current.paymentMethod === 'paymob' && ['pending', 'approved'].includes(current.status)) {
          if (++tries < 10) timer = window.setTimeout(load, 1500);
          else {
            try {
              const verified = await api(`/orders/by-ref/${token}/reconcile`, { method: 'POST' });
              if (active) {
                setOrder((previous) => previous ? { ...previous, ...verified } : previous);
                if (!verified.verified) setPaymentCheckNotice('Paymob has not confirmed this payment yet. Please keep your receipt and check My orders or the payment link in your email shortly.');
              }
            } catch {
              if (active) setPaymentCheckNotice('Payment confirmation is taking longer than usual. You can check this order again from My orders or use the payment link in your email.');
            }
          }
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };
    load();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  async function submitTransferReference(event) {
    event.preventDefault();
    setSavingReference(true);
    setReferenceError('');
    try {
      await api(`/orders/by-ref/${ref}/instapay-reference`, {
        method: 'POST', body: { reference: transferReference },
      });
      setReferenceSaved(true);
    } catch (saveError) {
      setReferenceError(saveError.message);
    } finally {
      setSavingReference(false);
    }
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!order) return <p role="status">Checking your order...</p>;

  const paid = ['paid', 'shipped'].includes(order.status);
  const isInstaPay = order.paymentMethod === 'instapay';
  const isCashOnDelivery = order.paymentMethod === 'cod';
  const whatsappNumber = (config.instaPayWhatsapp || '').replace(/\D/g, '');
  const whatsappMessage = `Hi Stringtopia, I sent an InstaPay payment for order ${order.paymentReference}. I am attaching my payment screenshot here.`;
  const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}` : '';

  return (
    <div className="checkout-confirmation card space-y-3">
      <p className="empty-cart-kicker">Stringtopia order</p>
      <h1 className="text-3xl font-bold">
        {paid ? 'Thank you! 🧶' : order.status === 'expired' ? 'This order has expired' : order.status === 'cancelled' ? 'This order was cancelled' : isCashOnDelivery && order.status === 'pending' ? 'Your order is placed' : isInstaPay && order.status === 'pending' ? 'Complete your InstaPay transfer' : failed ? 'The payment did not go through' : 'Confirming your payment...'}
      </h1>
      {order.items.map((item, index) => <p key={index}>{item.qty} × {item.name}</p>)}
      {order.promoCode && order.discountAmount > 0 && <p className="checkout-promo-feedback checkout-promo-feedback-success">Promo {order.promoCode}: saved {money(order.discountAmount)}</p>}
      <p className="font-medium">Total: {money(order.total)}</p>
      {paymentCheckNotice && <p className="text-sm text-stone-600" role="status">{paymentCheckNotice}</p>}
      {order.method === 'pickup' && config.pickupAddress && <p className="text-sm">Pick up at: {config.pickupAddress}</p>}

      {isCashOnDelivery && order.status === 'pending' && (
        <p className="text-sm text-stone-700">Your order is confirmed. Pay in cash {order.method === 'pickup' ? 'when you collect it' : 'when it arrives'}.</p>
      )}

      {isInstaPay && order.status === 'pending' && (
        <section className="instapay-confirmation" aria-labelledby="instapay-title">
          <h2 id="instapay-title" className="text-xl font-bold">Send your InstaPay transfer</h2>
          <p>Transfer <strong>{money(order.total)}</strong> to <strong>{config.instaPayAccountName || 'Stringtopia'}</strong> at <strong>{config.instaPayAddress}</strong>.</p>
          <p>Include this order reference in the transfer note:</p>
          <p className="instapay-reference">{order.paymentReference}</p>
          <p className="text-sm text-stone-700">Then choose one way to share your payment proof:</p>
          <fieldset className="instapay-proof-options">
            <legend className="sr-only">Choose how to share InstaPay payment proof</legend>
            <label className={`checkout-payment-option${proofChoice === 'reference' ? ' checkout-payment-option-selected' : ''}`}>
              <input type="radio" name="proofChoice" value="reference" checked={proofChoice === 'reference'} onChange={() => setProofChoice('reference')} />
              <span className="checkout-payment-option-copy"><strong>Enter the transfer reference</strong><span>Send the transaction reference here for confirmation.</span></span>
            </label>
            <label className={`checkout-payment-option${proofChoice === 'whatsapp' ? ' checkout-payment-option-selected' : ''}`}>
              <input type="radio" name="proofChoice" value="whatsapp" checked={proofChoice === 'whatsapp'} onChange={() => setProofChoice('whatsapp')} />
              <span className="checkout-payment-option-copy"><strong>Send a screenshot on WhatsApp</strong><span>Share a screenshot with your order reference.</span></span>
            </label>
          </fieldset>
          {proofChoice === 'reference' && (
            referenceSaved ? <p className="text-sm font-semibold text-green-800" role="status">Your transfer reference was sent to Stringtopia for confirmation.</p> :
              <form onSubmit={submitTransferReference} className="instapay-reference-form">
                <label className="sr-only" htmlFor="instapay-transfer-reference">InstaPay transaction reference</label>
                <input id="instapay-transfer-reference" className="field w-full" required minLength={3} maxLength={80} value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="InstaPay transaction reference" />
                {referenceError && <p className="checkout-error" role="alert">{referenceError}</p>}
                <button type="submit" className="btn btn-primary" disabled={savingReference}>{savingReference ? 'Sending…' : 'Send reference'}</button>
              </form>
          )}
          {proofChoice === 'whatsapp' && (whatsappUrl
            ? <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">Open WhatsApp to send proof</a>
            : <p className="checkout-error" role="alert">WhatsApp proof is not configured yet. Choose the transfer reference option.</p>)}
          <p className="text-sm text-stone-600">Your order remains awaiting confirmation until Stringtopia verifies the transfer.</p>
        </section>
      )}

      {order.status === 'expired' && <p className="text-sm text-stone-600">Your items were released back into stock. You can place a new order any time.</p>}
      {order.status === 'cancelled' && <p className="text-sm text-stone-600">This order was cancelled. You can place a new order any time.</p>}
      {paid && <p className="text-sm text-stone-600">Payment is confirmed. Bookmark this page to check on your order; we also email you a link.</p>}
      {failed && order.paymentMethod === 'paymob' && ['pending', 'approved'].includes(order.status) && (
        <Link href={`/pay/${ref}`} className="btn btn-primary">Try Paymob again</Link>
      )}
      <Link href="/" className="block text-yarn underline">Keep shopping</Link>
    </div>
  );
}
