import Link from 'next/link';

export default function CheckoutSteps({ current }) {
  const onCheckout = current === 'checkout';

  return (
    <nav className="checkout-progress" aria-label="Checkout progress">
      <ol>
        <li className={!onCheckout ? 'checkout-progress-step checkout-progress-step-active' : 'checkout-progress-step checkout-progress-step-complete'} aria-current={!onCheckout ? 'step' : undefined}>
          {onCheckout ? (
            <Link href="/cart"><span>1</span> Cart</Link>
          ) : (
            <span className="checkout-progress-label"><span>1</span> Cart</span>
          )}
        </li>
        <li className={`checkout-progress-step${onCheckout ? ' checkout-progress-step-active' : ''}`} aria-current={onCheckout ? 'step' : undefined}>
          <span className="checkout-progress-label"><span>2</span> Address &amp; payment</span>
        </li>
      </ol>
    </nav>
  );
}
