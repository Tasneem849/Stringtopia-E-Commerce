'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './Providers';

export default function AddToCartButton({ product }) {
  const { cart, ready, addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const resetTimer = useRef(null);
  const cartItem = cart.find((item) => String(item.productId) === String(product._id));
  const stock = Number(product.stock);
  const limit = Number.isFinite(stock) ? Math.min(20, Math.max(0, stock)) : 20;
  const atLimit = Boolean(cartItem && cartItem.qty >= limit);
  const soldOut = limit === 0;

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function handleClick() {
    if (!ready || atLimit || soldOut) return;
    addToCart(product, 1);
    setAdded(true);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setAdded(false), 1300);
  }

  const label = soldOut ? 'Sold out' : atLimit ? 'In cart' : added ? 'Added!' : 'Add to cart';

  return (
    <>
      <button
        type="button"
        className="product-add-button"
        onClick={handleClick}
        disabled={!ready || atLimit || soldOut}
        aria-label={soldOut ? `${product.name} is sold out` : `Add one ${product.name} to cart`}
        title={soldOut ? 'See product details for reservation options' : atLimit ? 'Maximum available quantity is in your cart' : 'Add one to cart'}
      >
        <span className="product-add-icon" aria-hidden="true">+</span>
        <span>{label}</span>
      </button>
      {added && <span className="sr-only" role="status">{product.name} added to cart</span>}
    </>
  );
}
