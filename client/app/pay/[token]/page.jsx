'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

// Payment links (emails, "Pay now") open here. A fresh Paymob checkout is created on demand, so links never go stale.
export default function Pay() {
  const { token } = useParams();
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/orders/pay/${token}`, { method: 'POST' })
      .then(({ url }) => { window.location.href = url; })
      .catch((e) => setErr(e.message));
  }, [token]);

  if (!err) return <p>Taking you to the secure payment page...</p>;
  return (
    <div className="card space-y-2">
      <p className="text-red-700">{err}</p>
      <Link href="/" className="text-yarn underline">Back to the shop</Link>
    </div>
  );
}
