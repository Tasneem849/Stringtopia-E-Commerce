'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/components/Providers';

// This guard is only for convenience: the API itself rejects non-admins on every admin route.
export default function AdminLayout({ children }) {
  const { user, ready } = useStore();
  const pathname = usePathname();
  if (!ready) return <p>Loading...</p>;
  if (user?.role !== 'admin') {
    const loginHref = `/login?next=${encodeURIComponent(pathname || '/admin')}`;
    return <p role="status">Admin access is required. <Link href={loginHref} className="underline">Log in with your admin account</Link> to continue.</p>;
  }
  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-4 border-b pb-2 font-medium">
        <Link className="nav-link" href="/admin">Reservation requests</Link>
        <Link className="nav-link" href="/admin/orders">Orders</Link>
        <Link className="nav-link" href="/admin/orders/new">Add order</Link>
        <Link className="nav-link" href="/admin/finance">Finance</Link>
        <Link className="nav-link" href="/admin/products">Products</Link>
        <Link className="nav-link" href="/admin/promos">Promo codes</Link>
        <Link className="nav-link" href="/admin/audio">Background audio</Link>
      </nav>
      {children}
    </>
  );
}
