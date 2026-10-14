'use client';
import Link from 'next/link';
import ProductPrice from './ProductPrice';
import AddToCartButton from './AddToCartButton';
import FavoriteButton from './FavoriteButton';
import Thumb from './Thumb';

export default function ProductCard({ product }) {
  return (
    <article className="card card-lift product-card">
      <Link href={`/products/${product.slug}`} className="block">
        <Thumb src={product.images?.[0]} />
        <h2 className="mt-2 text-xl font-bold">{product.name}</h2>
        <p className="text-sm text-stone-600">
          <ProductPrice product={product} />
          {product.stock === 0 && <span className="chip">Sold out: reserve it</span>}
        </p>
      </Link>
      <FavoriteButton product={product} overlay />
      <div className="product-card-actions">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}
