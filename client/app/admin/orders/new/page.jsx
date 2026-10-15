'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, effectivePrice, money } from '@/lib/api';
import { useStore } from '@/components/Providers';

const input = 'field w-full';

export default function NewAdminOrder() {
  const { token } = useStore();
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [form, setForm] = useState({
    source: 'whatsapp', name: '', phone: '', email: '', paymentMethod: 'cash', paymentReceived: true,
    instaPayReference: '', deliveryMethod: 'pickup', shippingFee: '0', discountAmount: '0',
    line1: '', line2: '', city: '', postalCode: '', country: 'Egypt', note: '',
  });
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    if (!token) {
      setProducts([]);
      setLoadError('Your admin session is missing. Please log in again.');
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setLoadError('');
    const query = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : '';
    api(`/admin/products?limit=50${query}`, { token })
      .then((result) => { if (active) setProducts(Array.isArray(result?.products) ? result.products : []); })
      .catch((err) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, search]);

  const visibleProducts = useMemo(() => products.filter((product) => product.stock > 0
    && product.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [products, search]);
  const productById = useMemo(() => new Map(products.map((product) => [String(product._id), product])), [products]);
  const subtotal = items.reduce((sum, line) => sum + effectivePrice(productById.get(line.productId)) * line.qty, 0);
  const costComplete = items.length > 0 && items.every((line) => Number.isFinite(productById.get(line.productId)?.unitCost));
  const itemCosts = items.reduce((sum, line) => {
    const cost = productById.get(line.productId)?.unitCost;
    return sum + (Number.isFinite(cost) ? cost * line.qty : 0);
  }, 0);
  const discount = Math.max(0, Math.round((Number.parseFloat(form.discountAmount) || 0) * 100));
  const shippingFee = form.deliveryMethod === 'delivery' ? Math.max(0, Math.round((Number.parseFloat(form.shippingFee) || 0) * 100)) : 0;
  const total = subtotal - discount + shippingFee;

  function addProduct() {
    if (!selectedProduct) return;
    const product = productById.get(selectedProduct);
    if (!product?.stock) return;
    setItems((current) => {
      const existing = current.find((line) => line.productId === selectedProduct);
      if (!existing) return [...current, { productId: selectedProduct, qty: 1 }];
      if (existing.qty >= product.stock) return current;
      return current.map((line) => line.productId === selectedProduct ? { ...line, qty: line.qty + 1 } : line);
    });
    setSelectedProduct('');
    setError('');
  }

  function setQuantity(productId, rawValue) {
    const product = productById.get(productId);
    const qty = Math.max(1, Math.min(product?.stock || 1, Number.parseInt(rawValue, 10) || 1));
    setItems((current) => current.map((line) => line.productId === productId ? { ...line, qty } : line));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSavedOrder(null);
    if (!items.length) { setError('Add at least one in-stock product.'); return; }
    if (discount > subtotal) { setError('Discount cannot exceed the items subtotal.'); return; }
    if (form.paymentReceived && form.paymentMethod === 'instapay' && !form.instaPayReference.trim()) {
      setError('Enter the InstaPay transfer reference before marking payment received.');
      return;
    }
    setSaving(true);
    try {
      const delivery = form.deliveryMethod === 'pickup'
        ? { method: 'pickup' }
        : { method: 'delivery', address: {
          line1: form.line1.trim(), ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
          city: form.city.trim(), ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}), country: form.country.trim(),
        } };
      const result = await api('/admin/orders', { token, method: 'POST', body: {
        source: form.source,
        customer: { name: form.name.trim(), phone: form.phone.trim() },
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        items,
        delivery,
        paymentMethod: form.paymentMethod,
        paymentReceived: form.paymentReceived,
        ...(form.instaPayReference.trim() ? { instaPayReference: form.instaPayReference.trim() } : {}),
        shippingFee,
        discountAmount: discount,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      } });
      setSavedOrder(result);
      setItems([]);
      setSearch('');
      setForm((current) => ({ ...current, name: '', phone: '', email: '', instaPayReference: '', discountAmount: '0', note: '', line1: '', line2: '', city: '', postalCode: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Add an offline order</h1>
        <p className="mt-1 text-sm text-stone-600">Record a WhatsApp or phone order. Product prices and costs are captured when you save it, and available stock is reserved.</p>
      </div>
      {loadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">Could not load products: {loadError}</p>}
      {savedOrder && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        Order {String(savedOrder._id).slice(-8).toUpperCase()} was saved. <Link className="font-semibold underline" href="/admin/orders">View orders</Link>
      </div>}
      <form onSubmit={submit} className="space-y-4">
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Customer and order source</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Received through
              <select className={input} value={form.source} onChange={(event) => setField('source', event.target.value)}>
                <option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Customer name
              <input required minLength={2} maxLength={80} className={input} value={form.name} onChange={(event) => setField('name', event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium">Phone number
              <input required minLength={6} maxLength={30} type="tel" className={input} value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium">Email (optional)
              <input type="email" className={input} value={form.email} onChange={(event) => setField('email', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Products</h2>
          {loading ? <p role="status" className="text-stone-600">Loading products...</p> : (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input aria-label="Search in-stock products" className={input} placeholder="Find a product" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedProduct(''); }} />
              <select className={input} aria-label="Select a product" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                <option value="">Choose an in-stock product</option>
                {visibleProducts.map((product) => <option key={product._id} value={product._id}>{product.name} · {money(effectivePrice(product))} · {product.stock} available</option>)}
              </select>
              <button type="button" onClick={addProduct} disabled={!selectedProduct} className="btn btn-ghost whitespace-nowrap">Add item</button>
            </div>
          )}
          {!loading && !products.some((product) => product.stock > 0) && <p className="text-sm text-stone-600">There are no in-stock products available to add.</p>}
          {items.length > 0 && <div className="space-y-2">
            {items.map((line) => {
              const product = productById.get(line.productId);
              if (!product) return null;
              return <div key={line.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{product.name}</p><p className="text-sm text-stone-600">{money(effectivePrice(product))} each{Number.isFinite(product.unitCost) ? ` · cost ${money(product.unitCost)} each` : ' · unit cost not set'}</p></div>
                <label className="flex items-center gap-2 text-sm">Qty <input className="field w-20" type="number" min="1" max={product.stock} value={line.qty} onChange={(event) => setQuantity(line.productId, event.target.value)} /></label>
                <strong>{money(effectivePrice(product) * line.qty)}</strong>
                <button type="button" className="cursor-pointer text-red-700 underline" onClick={() => setItems((current) => current.filter((item) => item.productId !== line.productId))}>Remove</button>
              </div>;
            })}
          </div>}
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Fulfillment and payment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Fulfillment
              <select className={input} value={form.deliveryMethod} onChange={(event) => setField('deliveryMethod', event.target.value)}>
                <option value="pickup">Pickup</option><option value="delivery">Delivery</option>
              </select>
            </label>
            {form.deliveryMethod === 'delivery' && <label className="space-y-1 text-sm font-medium">Delivery fee (EGP)
              <input className={input} type="number" min="0" step="0.01" value={form.shippingFee} onChange={(event) => setField('shippingFee', event.target.value)} />
            </label>}
            {form.deliveryMethod === 'delivery' && <>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">Address
                <input required minLength={3} maxLength={120} className={input} value={form.line1} onChange={(event) => setField('line1', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium">Apartment or extra details (optional)
                <input maxLength={120} className={input} value={form.line2} onChange={(event) => setField('line2', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium">City
                <input required minLength={2} maxLength={80} className={input} value={form.city} onChange={(event) => setField('city', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium">Postal code (optional)
                <input maxLength={20} className={input} value={form.postalCode} onChange={(event) => setField('postalCode', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium">Country
                <input required minLength={2} maxLength={60} className={input} value={form.country} onChange={(event) => setField('country', event.target.value)} />
              </label>
            </>}
            <label className="space-y-1 text-sm font-medium">Payment method
              <select className={input} value={form.paymentMethod} onChange={(event) => {
                const paymentMethod = event.target.value;
                setForm((current) => ({ ...current, paymentMethod, paymentReceived: paymentMethod === 'cash' }));
              }}>
                <option value="cash">Cash</option><option value="instapay">InstaPay</option><option value="cod">Cash on Delivery</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">Discount (EGP)
              <input className={input} type="number" min="0" max={(subtotal / 100).toFixed(2)} step="0.01" value={form.discountAmount} onChange={(event) => setField('discountAmount', event.target.value)} />
            </label>
            {form.paymentMethod === 'instapay' && <label className="space-y-1 text-sm font-medium sm:col-span-2">InstaPay transfer reference {form.paymentReceived ? '' : '(optional until confirmed)'}
              <input className={input} maxLength={80} required={form.paymentReceived} value={form.instaPayReference} onChange={(event) => setField('instaPayReference', event.target.value)} />
            </label>}
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.paymentReceived} onChange={(event) => setField('paymentReceived', event.target.checked)} />
            <span><strong>Payment received</strong><span className="block text-stone-600">Leave unchecked for cash due later, delivery payment, or an InstaPay transfer that still needs confirmation.</span></span>
          </label>
          <label className="block space-y-1 text-sm font-medium">Order note (optional)
            <textarea className={input} maxLength={500} rows={3} value={form.note} onChange={(event) => setField('note', event.target.value)} placeholder="Customer request, custom color, or other order details" />
          </label>
        </section>

        <section className="card space-y-2" aria-live="polite">
          <h2 className="text-lg font-semibold">Order total</h2>
          <p className="flex justify-between"><span>Products</span><strong>{money(subtotal)}</strong></p>
          <p className="flex justify-between"><span>Discount</span><strong>−{money(discount)}</strong></p>
          <p className="flex justify-between"><span>Delivery</span><strong>{money(shippingFee)}</strong></p>
          <p className="flex justify-between border-t border-stone-200 pt-2 text-lg"><span>Total</span><strong>{money(total)}</strong></p>
          {costComplete ? <p className="text-sm text-emerald-800">Estimated product gross profit after discount: <strong>{money(subtotal - discount - itemCosts)}</strong> (delivery and monthly expenses are excluded).</p>
            : items.length > 0 && <p className="text-sm text-amber-800">Set a unit cost for every item in <Link className="underline" href="/admin/products">Manage products</Link> to include this order in tracked profit.</p>}
        </section>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <button type="submit" disabled={saving || loading || !items.length || Boolean(loadError)} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving order…' : 'Save order'}</button>
      </form>
    </div>
  );
}
