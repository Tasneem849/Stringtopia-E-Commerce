'use client';

import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';

const NEW_PROMO = { code: '', discountType: 'percentage', discountValue: '10', active: true };

export default function AdminPromoCodes() {
  const { token } = useStore();
  const [promos, setPromos] = useState(null);
  const [draft, setDraft] = useState(NEW_PROMO);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    if (!token) return;
    api('/admin/promo-codes', { token })
      .then(setPromos)
      .catch((loadError) => {
        setError(loadError.message);
        setPromos([]);
      });
  }, [token]);

  async function createPromo(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(draft.discountValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a discount greater than zero.');
      return;
    }
    if (draft.discountType === 'percentage' && amount > 100) {
      setError('A percentage discount cannot exceed 100%.');
      return;
    }

    setSaving(true);
    try {
      const created = await api('/admin/promo-codes', {
        token,
        method: 'POST',
        body: {
          code: draft.code.trim().toUpperCase(),
          discountType: draft.discountType,
          discountValue: draft.discountType === 'fixed' ? Math.round(amount * 100) : Math.round(amount),
          active: draft.active,
        },
      });
      setPromos((current) => [created, ...(current || [])]);
      setDraft(NEW_PROMO);
      setSuccess('Promo code created.');
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePromo(promo) {
    setError('');
    setSuccess('');
    setUpdatingId(promo._id);
    try {
      const updated = await api('/admin/promo-codes/' + promo._id + '/active', {
        token,
        method: 'PATCH',
        body: { active: !promo.active },
      });
      setPromos((current) => current.map((item) => item._id === updated._id ? updated : item));
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setUpdatingId('');
    }
  }

  function discountLabel(promo) {
    return promo.discountType === 'percentage'
      ? promo.discountValue + '% off items'
      : money(promo.discountValue) + ' off items';
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="empty-cart-kicker">Little rewards for lovely customers</p>
        <h1 className="text-2xl font-bold">Promo codes</h1>
      </div>

      <form onSubmit={createPromo} className="space-y-3 card promo-admin-form">
        <h2 className="font-semibold">Create a promo code</h2>
        <label className="grid gap-1 text-sm font-semibold" htmlFor="promo-code">
          Code
          <input
            id="promo-code"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_-]+"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="LOVELY10"
            value={draft.code}
            onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
            className="field w-full"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold" htmlFor="promo-discount-type">
            Discount type
            <select
              id="promo-discount-type"
              value={draft.discountType}
              onChange={(event) => setDraft((current) => ({ ...current, discountType: event.target.value }))}
              className="field w-full"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="promo-discount-value">
            {draft.discountType === 'percentage' ? 'Percent off' : 'Amount off (EGP)'}
            <input
              id="promo-discount-value"
              required
              type="number"
              min={draft.discountType === 'percentage' ? '1' : '0.01'}
              max={draft.discountType === 'percentage' ? '100' : undefined}
              step={draft.discountType === 'percentage' ? '1' : '0.01'}
              value={draft.discountValue}
              onChange={(event) => setDraft((current) => ({ ...current, discountValue: event.target.value }))}
              className="field w-full"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
          />
          Activate this code immediately
        </label>

        {error && <p className="checkout-error" role="alert">{error}</p>}
        {success && <p className="checkout-promo-feedback checkout-promo-feedback-success" role="status">{success}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create promo code'}
        </button>
      </form>

      <section className="space-y-3" aria-labelledby="promo-list-title">
        <h2 id="promo-list-title" className="text-xl font-bold">Your promo codes</h2>
        {promos === null && <p role="status">Loading promo codes…</p>}
        {promos?.length === 0 && <p className="card">No promo codes yet. Create one above to get started.</p>}
        {promos?.map((promo) => (
          <article key={promo._id} className="card promo-admin-row">
            <div>
              <div className="promo-admin-meta">
                <strong className="promo-admin-code">{promo.code}</strong>
                <span className={'promo-admin-status ' + (promo.active ? 'promo-admin-status-active' : 'promo-admin-status-inactive')}>
                  {promo.active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p>{discountLabel(promo)}</p>
            </div>
            <button
              type="button"
              className={promo.active ? 'btn btn-ghost' : 'btn btn-mint'}
              disabled={updatingId === promo._id}
              onClick={() => togglePromo(promo)}
            >
              {updatingId === promo._id ? 'Saving…' : promo.active ? 'Disable' : 'Activate'}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

