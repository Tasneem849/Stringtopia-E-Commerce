'use client';
import Link from 'next/link';
import { useStore } from '@/components/Providers';

// This guard is only for convenience: the API itself rejects non-admins on every admin route.
export default function AdminLayout({ children }) {
  const { user, ready } = useStore();
  if (!ready) return <p>Loading...</p>;
  if (user?.role !== 'admin') return <p>Admins only. <Link href="/login" className="underline">Log in</Link></p>;
  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-4 border-b pb-2 font-medium">
        <Link className="nav-link" href="/admin">Reservation requests</Link>
        <Link className="nav-link" href="/admin/orders">Orders</Link>
        <Link className="nav-link" href="/admin/products">Products</Link>
        <Link className="nav-link" href="/admin/audio">Background audio</Link>
      </nav>
      {children}
    </>
  );
}
