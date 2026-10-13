'use client';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { useStore } from '@/components/Providers';

export default function Favorites() {
  const { user, token, ready, favorites, favoritesLoading, favoritesError } = useStore();

  if (!ready) return <p role="status">Loading your favorites…</p>;

  if (!user || !token) {
    return (
      <section className="favorites-gate card" aria-labelledby="favorites-gate-title">
        <p className="favorites-heart" aria-hidden="true">♡</p>
        <p className="empty-cart-kicker">A little corner just for you</p>
        <h1 id="favorites-gate-title" className="text-3xl font-bold">Sign in to save your favorite pieces.</h1>
        <p className="my-3 text-stone-600">Create an account or log in to keep a personal list of the handmade pieces you love.</p>
        <Link href="/login" className="btn btn-primary">Log in or create an account</Link>
      </section>
    );
  }

  if (favoritesLoading) return <p role="status">Gathering your saved pieces…</p>;

  if (favoritesError) {
    return (
      <section className="card space-y-3" aria-labelledby="favorites-error-title">
        <h1 id="favorites-error-title" className="text-2xl font-bold">We couldn’t load your favorites.</h1>
        <p className="text-stone-600">{favoritesError}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
      </section>
    );
  }

  return (
    <section aria-labelledby="favorites-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="empty-cart-kicker">Saved with love</p>
          <h1 id="favorites-title" className="text-3xl font-bold">Your favorites</h1>
        </div>
        <Link href="/" className="btn btn-ghost">Explore the shop</Link>
      </div>

      {favorites.length ? (
        <div className="yarn-cycle grid grid-cols-2 gap-4 md:grid-cols-3">
          {favorites.map((product) => <ProductCard key={product._id} product={product} />)}
        </div>
      ) : (
        <div className="favorites-empty card">
          <p className="favorites-heart" aria-hidden="true">♡</p>
          <h2 className="text-2xl font-bold">No favorites saved yet.</h2>
          <p className="mt-2 max-w-md text-stone-600">Tap the heart on any piece to keep it here for later.</p>
          <Link href="/" className="btn btn-primary mt-5">Find something lovely</Link>
        </div>
      )}
    </section>
  );
}
