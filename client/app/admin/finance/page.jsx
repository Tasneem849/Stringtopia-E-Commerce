'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';
import ConfirmDialog from '@/components/ConfirmDialog';

const CATEGORIES = [
  ['materials', 'Yarn and materials'], ['packaging', 'Packaging'], ['shipping', 'Shipping'],
  ['marketing', 'Marketing'], ['tools', 'Tools and equipment'], ['other', 'Other'],
];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => today().slice(0, 7);
const EMPTY_SUMMARY = {
  paidOrderCount: 0, paidProductRevenue: 0, shippingCollected: 0, costCompleteOrders: 0,
  trackedProductRevenue: 0, trackedProductCosts: 0, trackedGrossProfit: 0, expenseTotal: 0,
  trackedNetProfit: 0, uncostedOrders: 0, uncostedItems: 0,
};

function Metric({ label, value, hint, tone = '' }) {
  return <article className="card space-y-1">
    <p className="text-sm font-medium text-stone-600">{label}</p>
    <p className={`text-xl font-bold ${tone}`}>{value}</p>
    {hint && <p className="text-xs text-stone-500">{hint}</p>}
  </article>;
}

export default function AdminFinance() {
  const { token } = useStore();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ description: '', category: 'materials', amount: '', date: today() });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setReport(null);
      setError('Your admin session is missing. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setReport(await api(`/admin/finance?month=${encodeURIComponent(month)}`, { token }));
    } catch (err) {
      setReport(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, month]);

  useEffect(() => { load(); }, [load]);

  async function addExpense(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/admin/finance/expenses', { token, method: 'POST', body: {
        description: form.description.trim(), category: form.category,
        amount: Math.round(Number.parseFloat(form.amount) * 100), date: `${form.date}T12:00:00.000Z`,
      } });
      setForm({ description: '', category: 'materials', amount: '', date: `${month}-01` });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api(`/admin/finance/expenses/${deleteTarget._id}`, { token, method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const summary = report?.summary || EMPTY_SUMMARY;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finance</h1>
          <p className="mt-1 text-sm text-stone-600">Track paid sales, saved product costs, monthly expenses, and estimated profit.</p>
        </div>
        <label className="space-y-1 text-sm font-medium">Report month
          <input className="field block" type="month" value={month} onChange={(event) => {
            const nextMonth = event.target.value;
            setMonth(nextMonth);
            if (nextMonth) setForm((current) => ({ ...current, date: `${nextMonth}-01` }));
          }} />
        </label>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p role="status" className="text-stone-600">Loading finance report...</p>}
      {!loading && report && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Monthly finance summary">
          <Metric label="Paid orders" value={summary.paidOrderCount} hint="Counted by payment date; older orders use order date." />
          <Metric label="Product sales" value={money(summary.paidProductRevenue)} hint="After discounts, before product costs." />
          <Metric label="Delivery collected" value={money(summary.shippingCollected)} hint="Excluded from profit because shipping costs aren't itemized." />
          <Metric label="Product costs tracked" value={money(summary.trackedProductCosts)} hint={`${summary.costCompleteOrders} paid orders have complete unit costs.`} />
          <Metric label="Gross profit tracked" value={money(summary.trackedGrossProfit)} hint="Known-cost product revenue minus product costs." tone={summary.trackedGrossProfit < 0 ? 'text-red-700' : 'text-emerald-800'} />
          <Metric label="Logged expenses" value={money(summary.expenseTotal)} hint="Expenses entered for this month." />
          <Metric label="Net profit tracked" value={money(summary.trackedNetProfit)} hint="Product gross profit + delivery collected − all logged expenses." tone={summary.trackedNetProfit < 0 ? 'text-red-700' : 'text-emerald-800'} />
          <Metric label="Sales needing costs" value={`${summary.uncostedOrders} orders · ${summary.uncostedItems} items`} hint="Add product unit costs for future orders; old costs are not guessed." />
        </section>
        {summary.uncostedOrders > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          {summary.uncostedOrders} paid order{summary.uncostedOrders === 1 ? '' : 's'} in this month have missing cost snapshots. Their revenue is shown in Product sales, but excluded from tracked profit. This keeps older orders from receiving guessed costs.
        </p>}
      </>}

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={addExpense} className="card space-y-3">
          <div><h2 className="text-lg font-semibold">Log an expense</h2><p className="text-sm text-stone-600">Amounts are stored in EGP and applied to the selected report month. For accurate profit, don’t enter materials here if they are already included in product unit costs.</p></div>
          <label className="block space-y-1 text-sm font-medium">Description
            <input required minLength={2} maxLength={160} className="field w-full" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="e.g. cotton yarn restock" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Category
              <select className="field w-full" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Amount (EGP)
              <input required className="field w-full" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">Date
            <input required className="field w-full" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <button type="submit" disabled={saving || !token} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving expense…' : 'Add expense'}</button>
        </form>

        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold">Expenses</h2><p className="text-sm text-stone-600">{report?.expenses?.length || 0} records in {month || 'selected month'}</p></div>
            <button type="button" onClick={load} disabled={loading} className="cursor-pointer underline disabled:opacity-50">Refresh</button>
          </div>
          {!loading && report?.expenses?.length === 0 && <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">No expenses have been entered for this month.</p>}
          <ul className="space-y-2">
            {report?.expenses?.map((expense) => <li key={expense._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
              <div className="min-w-0"><p className="font-medium">{expense.description}</p><p className="text-sm capitalize text-stone-600">{CATEGORIES.find(([category]) => category === expense.category)?.[1] || expense.category} · {new Date(expense.date).toLocaleDateString()}</p></div>
              <strong>{money(expense.amount)}</strong>
              <button type="button" onClick={() => { setDeleteError(''); setDeleteTarget(expense); }} className="cursor-pointer text-red-700 underline">Delete</button>
            </li>)}
          </ul>
        </section>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this expense?"
        description={deleteTarget ? `Remove “${deleteTarget.description}” (${money(deleteTarget.amount)}) from the finance ledger? The monthly totals will be recalculated.` : ''}
        confirmLabel="Delete expense"
        cancelLabel="Keep expense"
        busyLabel="Deleting…"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={removeExpense}
        onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteError(''); } }}
      />
    </div>
  );
}
