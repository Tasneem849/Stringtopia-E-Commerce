'use client';
import Link from 'next/link';
import ProductPrice from './ProductPrice';
import AddToCartButton from './AddToCartButton';
import FavoriteButton from './FavoriteButton';
import Thumb from './Thumb';
import { DEMO_MODE } from '@/lib/demoMode';

export default function ProductCard({ product }) {
  return (
    <article className="card card-lift product-card">
      <Link href={`/products/${product.slug}`} className="block">
        <Thumb src={product.images?.[0]} />
        <h2 className="mt-2 text-xl font-bold">{product.name}</h2>
        <p className="text-sm text-stone-600">
          <ProductPrice product={product} />
          {!DEMO_MODE && product.stock === 0 && <span className="chip">Sold out: reserve it</span>}
        </p>
      </Link>
      {!DEMO_MODE && <FavoriteButton product={product} overlay />}
      {!DEMO_MODE && <div className="product-card-actions">
        {product.variants?.length ? (
          <Link
            href={`/products/${product.slug}`}
            className="product-add-button"
            aria-label={`Open ${product.name} to choose its options`}
          >
            <span className="product-add-icon" aria-hidden="true">+</span>
            <span>Choose options</span>
          </Link>
        ) : <AddToCartButton product={product} />}
      </div>}
      {DEMO_MODE && <p className="mt-3 text-xs font-semibold text-stone-500">Catalog preview</p>}
    </article>
  );
}
