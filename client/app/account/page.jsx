'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';
import ConfirmDialog from '@/components/ConfirmDialog';

const displayDate = (value) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long', timeStyle: 'short',
}).format(new Date(value));

export default function AccountPage() {
  const { token, user, ready } = useStore();
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace('/login?next=%2Faccount');
      return;
    }
    if (user?.role !== 'customer') {
      router.replace(user?.role === 'admin' ? '/admin' : '/login');
      return;
    }

    let active = true;
    api('/auth/account-deletion', { token })
      .then((result) => { if (active) setStatus(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, token, user?.role, router]);

  async function requestDeletion() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setStatus(await api('/auth/account-deletion', { token, method: 'POST' }));
      setConfirmOpen(false);
      setMessage('Deletion is scheduled. You can cancel it here during the 7-day grace period.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/auth/account-deletion', { token, method: 'DELETE' });
      setStatus(result);
      setMessage(result.cancelled ? 'Deletion cancelled. Your account will stay active.' : 'There is no pending deletion request.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || loading) return <p role="status">Loading account settings…</p>;
  if (!token || user?.role !== 'customer') return null;
  if (!status) {
    return (
      <section className="card mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Account settings</h1>
        <p role="alert" className="text-red-700">{error || 'Could not load your account deletion status.'}</p>
        <button type="button" className="btn btn-ghost" onClick={async () => {
          setLoading(true);
          setError('');
          try { setStatus(await api('/auth/account-deletion', { token })); }
          catch (requestError) { setError(requestError.message); }
          finally { setLoading(false); }
        }}>Try again</button>
      </section>
    );
  }

  const scheduledFor = status?.scheduledFor;
  return (
    <section className="mx-auto max-w-2xl space-y-4" aria-labelledby="account-title">
      <header className="card space-y-2">
        <p className="empty-cart-kicker">Your Stringtopia account</p>
        <h1 id="account-title" className="text-3xl font-bold">Account settings</h1>
        <p className="text-stone-600">Manage your account and personal data.</p>
      </header>

      <section className="card space-y-3" aria-labelledby="deletion-title">
        <div>
          <p className="empty-cart-kicker">Account control</p>
          <h2 id="deletion-title" className="text-xl font-semibold">Delete your account</h2>
        </div>
        {scheduledFor ? (
          <>
            <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
              Your account is scheduled for deletion on <strong>{displayDate(scheduledFor)}</strong>.
            </p>
            <p className="text-sm text-stone-600">You can cancel the request any time before then. Signing in will not cancel it automatically.</p>
            <button type="button" className="btn btn-primary" onClick={cancelDeletion} disabled={busy}>
              {busy ? 'Updating…' : 'Cancel deletion and keep my account'}
            </button>
          </>
        ) : (
          <>
            <p>This schedules your account, sign-in credentials, and saved favorites for deletion after a 7-day grace period. You can cancel the request from this page during that week.</p>
            <p className="text-sm text-stone-600">This does not cancel existing orders. We may retain order details needed to fulfill an active order, resolve a refund, or meet legal and accounting requirements; identifying details are removed from order records when they are no longer needed.</p>
            <button type="button" className="btn btn-ghost text-red-800" onClick={() => setConfirmOpen(true)}>
              Request account deletion
            </button>
          </>
        )}
        {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-stone-500">See the <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link> for details about order-record retention.</p>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        kicker="STRINGTOPIA · ACCOUNT"
        title="Schedule account deletion?"
        description="Your account and saved favorites will be deleted after 7 days. You can cancel the request from Account settings at any time before the scheduled date. Existing orders are not cancelled."
        confirmLabel="Schedule deletion"
        busyLabel="Scheduling…"
        cancelLabel="Keep my account"
        confirmStyle="danger"
        busy={busy}
        error={error}
        onConfirm={requestDeletion}
        onCancel={() => { if (!busy) { setConfirmOpen(false); setError(''); } }}
      />
    </section>
  );
}
