'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from './Providers';
import BrandArtwork from './BrandArtwork';

export default function Header() {
  const { user, logout, cart } = useStore();
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const count = cart.reduce((n, i) => n + i.qty, 0);

  useEffect(() => {
    if (!showLogoutToast) return undefined;
    const timeout = window.setTimeout(() => setShowLogoutToast(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [showLogoutToast]);

  function handleLogout() {
    logout();
    setShowLogoutToast(true);
  }

  return (
    <header className="border-b-2 border-dashed border-ink/30 bg-sky">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 p-3">
        <Link href="/" className="logo"><BrandArtwork src="/icon.png" alt="" className="ball" />Stringtopia</Link>
        <div className="yarn-cycle flex flex-wrap items-center gap-1 text-sm">
          {/* key={count}: the number pops each time the cart changes */}
          <Link href="/cart" className="nav-link">Cart <span key={count} className={count ? 'pop' : ''}>({count})</span></Link>
          {user?.role === 'admin' && <Link href="/admin" className="nav-link">Admin</Link>}
          {user ? (
            <>
              {user.role === 'customer' && <Link href="/account" className="nav-link">Account</Link>}
              <Link href="/favorites" className="nav-link">Favorites</Link>
              <Link href="/orders" className="nav-link">My orders</Link>
              <button onClick={handleLogout} className="nav-link cursor-pointer">Log out</button>
            </>
          ) : (
            <Link href="/login" className="nav-link">Log in</Link>
          )}
        </div>
      </nav>
      {showLogoutToast && (
        <div role="status" aria-live="polite" className="fixed right-4 top-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-2xl border-2 border-dashed border-grass/60 bg-white px-4 py-3 shadow-xl">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass/20 text-green-800" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-extrabold">Signed out</strong>
            <span className="block text-sm text-stone-600">You’ve been logged out successfully.</span>
          </span>
        </div>
      )}
    </header>
  );
}
