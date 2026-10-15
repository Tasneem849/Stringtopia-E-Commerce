'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './Providers';

export default function AddToCartButton({ product }) {
  const { cart, ready, addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const [variant, setVariant] = useState(product.variants?.length === 1 ? product.variants[0] : '');
  const resetTimer = useRef(null);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const cartQty = cart.filter((item) => String(item.productId) === String(product._id)).reduce((sum, item) => sum + item.qty, 0);
  const stock = Number(product.stock);
  const limit = Number.isFinite(stock) ? Math.min(20, Math.max(0, stock)) : 20;
  const atLimit = cartQty >= limit;
  const soldOut = limit === 0;
  const needsVariant = variants.length > 0 && !variant;

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function handleClick() {
    if (!ready || atLimit || soldOut || needsVariant) return;
    if (!addToCart(product, 1, variant)) return;
    setAdded(true);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setAdded(false), 1300);
  }

  const label = soldOut ? 'Sold out' : atLimit ? 'In cart' : added ? 'Added!' : 'Add to cart';

  return (
    <>
      {variants.length > 0 && (
        <label className="sr-only" htmlFor={`variant-${product._id}`}>{product.variantLabel || 'Choose an option'} for {product.name}</label>
      )}
      {variants.length > 0 && (
        <select
          id={`variant-${product._id}`}
          className="field mb-2 w-full text-sm"
          value={variant}
          onChange={(event) => setVariant(event.target.value)}
          aria-label={`${product.variantLabel || 'Choose an option'} for ${product.name}`}
        >
          <option value="">Choose {product.variantLabel || 'an option'}</option>
          {variants.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
      )}
      <button
        type="button"
        className="product-add-button"
        onClick={handleClick}
        disabled={!ready || atLimit || soldOut || needsVariant}
        aria-label={soldOut ? `${product.name} is sold out` : `Add one ${product.name} to cart`}
        title={soldOut ? 'See product details for reservation options' : atLimit ? 'Maximum available quantity is in your cart' : needsVariant ? `Choose ${product.variantLabel || 'an option'} first` : 'Add one to cart'}
      >
        <span className="product-add-icon" aria-hidden="true">+</span>
        <span>{label}</span>
      </button>
      {added && <span className="sr-only" role="status">{product.name}{variant ? `, ${product.variantLabel || 'option'} ${variant},` : ''} added to cart</span>}
    </>
  );
}
