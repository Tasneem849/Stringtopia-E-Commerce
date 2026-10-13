'use client';
import Link from 'next/link';
import { useStore } from './Providers';

export default function Header() {
  const { user, logout, cart } = useStore();
  const count = cart.reduce((n, i) => n + i.qty, 0);
  return (
    <header className="border-b-2 border-dashed border-ink/30 bg-sky">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 p-3">
        <Link href="/" className="logo"><img src="/bear.png" alt="" className="ball" />Stringtopia</Link>
        <div className="yarn-cycle flex flex-wrap items-center gap-1 text-sm">
          {/* key={count}: the number pops each time the cart changes */}
          <Link href="/cart" className="nav-link">Cart <span key={count} className={count ? 'pop' : ''}>({count})</span></Link>
          {user?.role === 'admin' && <Link href="/admin" className="nav-link">Admin</Link>}
          {user ? (
            <>
              <Link href="/orders" className="nav-link">My orders</Link>
              <button onClick={logout} className="nav-link cursor-pointer">Log out</button>
            </>
          ) : (
            <Link href="/login" className="nav-link">Log in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
