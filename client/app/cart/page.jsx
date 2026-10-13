'use client';
import Link from 'next/link';
import { img, money } from '@/lib/api';
import { useStore } from '@/components/Providers';
import CheckoutSteps from '@/components/CheckoutSteps';

export default function Cart() {
  const { cart, setQty, removeItem, clearCart, ready } = useStore();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (!ready) return <p role="status">Loading your cart…</p>;

  if (!cart.length) {
    return (
      <>
        <CheckoutSteps current="cart" />
        <section className="empty-cart" aria-labelledby="empty-cart-title">
          <div className="empty-cart-art" aria-hidden="true">
            <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="140" cy="195" rx="91" ry="9" fill="#EADBC9" />
              <path d="M72 96H208L193 181H87L72 96Z" fill="#FCD432" stroke="#121411" strokeWidth="4" strokeLinejoin="round" />
              <path d="M82 119H198M86 144H194M91 168H189" stroke="#CD2221" strokeWidth="5" strokeLinecap="round" />
              <path d="M101 96C101 51 179 51 179 96" stroke="#121411" strokeWidth="7" strokeLinecap="round" />
              <circle cx="140" cy="86" r="34" fill="#F3B9C0" stroke="#8C4F54" strokeWidth="3" />
              <path d="M113 75C128 83 151 83 166 74M107 88C123 97 157 97 173 87M114 101C127 94 152 94 166 102" stroke="#FFF8EE" strokeWidth="4" strokeLinecap="round" />
              <path d="M136 52C132 64 132 105 139 119M149 53C143 67 144 101 151 118" stroke="#C47C85" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M53 61C47 56 39 64 53 75C67 64 59 56 53 61Z" fill="#CD2221" />
              <path d="M222 75C217 71 210 77 222 87C234 77 227 71 222 75Z" fill="#8EB936" />
              <path d="M195 42L198 50L206 53L198 56L195 64L192 56L184 53L192 50L195 42Z" fill="#1F1FD6" />
            </svg>
          </div>

          <div className="empty-cart-copy">
            <p className="empty-cart-kicker">A little space for something lovely</p>
            <h1 id="empty-cart-title" className="empty-cart-title">Your cart is waiting for its first handmade favorite.</h1>
            <p className="empty-cart-message">Explore the shop and find a crochet companion, a thoughtful gift, or a little treat for yourself.</p>
            <Link href="/" className="btn btn-primary empty-cart-cta">
              <span aria-hidden="true">✦</span> Browse all pieces
            </Link>
            <nav className="empty-cart-categories" aria-label="Browse popular categories">
              <Link href="/?category=Amigurumi">Amigurumi</Link>
              <Link href="/?category=Bags">Bags</Link>
              <Link href="/?category=Keychains">Keychains</Link>
            </nav>
            <p className="empty-cart-note"><span aria-hidden="true">♡</span> No account needed to check out</p>
          </div>
        </section>
      </>
    );
  }

  return (
    <section aria-labelledby="cart-title">
      <CheckoutSteps current="cart" />
      <div className="cart-page-heading">
        <div>
          <p className="empty-cart-kicker">Your handmade picks</p>
          <h1 id="cart-title" className="text-3xl font-bold">Shopping cart</h1>
        </div>
        <div className="cart-page-heading-actions">
          <button type="button" onClick={clearCart} className="btn btn-danger">Empty cart</button>
          <Link href="/" className="btn btn-ghost">Continue shopping</Link>
        </div>
      </div>

      <div className="cart-page-layout">
        <div className="cart-items" aria-label="Items in your cart">
          {cart.map((item) => (
            <article key={item.productId} className="cart-item card">
              <div className="cart-item-product">
                <div className="cart-item-image" aria-hidden="true">
                  {item.image ? <img src={img(item.image, 180)} alt="" loading="lazy" decoding="async" /> : <span>🧶</span>}
                </div>
                <div className="min-w-0">
                  <Link href={`/products/${item.slug}`} className="font-bold hover:underline">{item.name}</Link>
                  <p className="mt-1 text-sm text-stone-500">{money(item.price)} each</p>
                </div>
              </div>
              <div className="cart-item-controls">
                <label className="sr-only" htmlFor={`quantity-${item.productId}`}>Quantity for {item.name}</label>
                <input
                  id={`quantity-${item.productId}`}
                  type="number" min={1} max={20} value={item.qty} className="field w-20"
                  onChange={(event) => setQty(item.productId, Math.max(1, Math.min(20, +event.target.value || 1)))}
                />
                <strong className="cart-item-total">{money(item.price * item.qty)}</strong>
                <button type="button" onClick={() => removeItem(item.productId)} className="cart-remove-button">Remove</button>
              </div>
            </article>
          ))}
        </div>

        <aside className="cart-summary card" aria-labelledby="cart-summary-title">
          <h2 id="cart-summary-title" className="text-xl font-bold">Cart summary</h2>
          <div className="cart-summary-row"><span>{cart.reduce((count, item) => count + item.qty, 0)} items</span><span>{money(subtotal)}</span></div>
          <p className="cart-summary-note">Delivery and address details come next.</p>
          <Link href="/checkout" className="btn btn-primary w-full">Continue to checkout <span aria-hidden="true">→</span></Link>
          <p className="text-center text-sm text-stone-500">No account needed</p>
        </aside>
      </div>
    </section>
  );
}
