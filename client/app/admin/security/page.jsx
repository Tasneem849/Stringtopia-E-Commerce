'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';

export default function AdminSecurityLogPage() {
  const { token } = useStore();
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api('/admin/audit-log?limit=50', { token });
      setEvents(result.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => { if (token) void load(); }, [load, token]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin security log</h1>
          <p className="text-sm text-stone-600">Recent admin activity includes who made each change and which order or items it affected. Entries are retained for one year.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load} disabled={busy}>Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {busy && <p role="status">Loading admin activity…</p>}
      {!busy && !error && !events.length && <p className="card text-sm text-stone-600">No admin changes have been recorded yet.</p>}
      <ol className="space-y-2">
        {events.map((event) => (
          <li key={event._id} className="card flex flex-wrap items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-bold">{event.action || event.method} <span className="break-all font-mono text-xs">{event.route}</span></p>
              {event.summary && <p className="mt-1 break-words text-stone-700">{event.summary}</p>}
              <p className="mt-1 text-stone-600">{event.adminName || event.adminId?.name || 'Administrator'}{(event.adminEmail || event.adminId?.email) ? ` (${event.adminEmail || event.adminId.email})` : ''} · {new Date(event.createdAt).toLocaleString()}</p>
              <p className="mt-1 break-all text-xs text-stone-500">Request reference: {event.requestId}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.status < 400 ? 'bg-grass/30 text-ink' : 'bg-pink/30 text-ink'}`}>
              HTTP {event.status}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
