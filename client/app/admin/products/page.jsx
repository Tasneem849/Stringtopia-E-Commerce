'use client';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import ProductPrice from '@/components/ProductPrice';
import { useStore } from '@/components/Providers';
import ImageUploader from '@/components/ImageUploader';
import ConfirmDialog from '@/components/ConfirmDialog';

const BLANK = { id: null, name: '', price: '', salePrice: '', unitCost: '', stock: '1', category: '', colors: '', hasVariants: false, variantKind: 'Color', variantLabel: '', variants: '', images: [], description: '' };
const input = 'field w-full';

export default function AdminProducts() {
  const { token } = useStore();
  const [view, setView] = useState('add');
  const [list, setList] = useState([]);
  const [listPage, setListPage] = useState(1);
  const [listPages, setListPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState('');
  const [listError, setListError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const [stockDelta, setStockDelta] = useState('1');

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!token) {
        setList([]);
        setListError('Your admin session is missing. Please log in again.');
        setLoadingList(false);
        return;
      }
      setLoadingList(true);
      setListError('');
      try {
        const data = await api(`/admin/products?limit=20&page=${listPage}`, { token });
        if (active) {
          setList(Array.isArray(data?.products) ? data.products : []);
          setListPage(data?.page || 1);
          setListPages(data?.pages || 1);
          setListTotal(data?.total || 0);
        }
      } catch (error) {
        if (active) {
          setList([]);
          setListError(error.message);
        }
      } finally {
        if (active) setLoadingList(false);
      }
    }
    loadProducts();
    return () => { active = false; };
  }, [token, refreshKey, listPage]);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      if (!token) {
        setCategories([]);
        setCategoryError('Your admin session is missing. Please log in again.');
        setCategoryLoading(false);
        return;
      }
      setCategoryLoading(true);
      setCategoryError('');
      try {
        const data = await api('/admin/categories', { token });
        if (active) setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        if (active) {
          setCategories([]);
          setCategoryError(error.message);
        }
      } finally {
        if (active) setCategoryLoading(false);
      }
    }
    loadCategories();
    return () => { active = false; };
  }, [token, refreshKey, categoryRefreshKey]);

  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  async function addCategory() {
    const name = categoryName.trim();
    if (!name) return;
    setCategoryBusy(true);
    setCategoryError('');
    try {
      const created = await api('/admin/categories', { token, method: 'POST', body: { name } });
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setF((current) => ({ ...current, category: created.name }));
      setCategoryName('');
    } catch (error) {
      setCategoryError(error.message);
    } finally {
      setCategoryBusy(false);
    }
  }

  function deleteCategory(category) {
    if (category.productCount > 0) return;
    setCategoryError('');
    setConfirmationError('');
    setConfirmation({ type: 'category', item: category });
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    const regularPrice = Math.round(parseFloat(f.price) * 100);
    const salePrice = f.salePrice === '' ? null : Math.round(parseFloat(f.salePrice) * 100);
    const unitCost = f.unitCost === '' ? null : Math.round(parseFloat(f.unitCost) * 100);
    if (salePrice !== null && salePrice >= regularPrice) {
      setErr('Sale price must be lower than the regular price.');
      return;
    }
    if (unitCost !== null && (!Number.isSafeInteger(unitCost) || unitCost < 0)) {
      setErr('Enter a valid product cost, or leave it blank if unknown.');
      return;
    }
    const variants = [...new Map(f.variants.split(',').map((value) => value.trim()).filter(Boolean)
      .map((value) => [value.toLocaleLowerCase(), value])).values()];
    if (f.hasVariants && variants.length === 0) {
      setErr('Add at least one selectable variant choice, such as Sage, Bear, or Panda.');
      return;
    }
    if (f.hasVariants && f.variantKind === 'custom' && !f.variantLabel.trim()) {
      setErr('Add a label describing the custom variant choices.');
      return;
    }
    const variantLabel = f.variantKind === 'custom' ? f.variantLabel.trim() : f.variantKind;
    const body = {
      name: f.name, description: f.description, category: f.category || undefined,
      price: regularPrice, salePrice, unitCost,
      ...(f.id ? {} : { stock: parseInt(f.stock, 10) }),
      colors: f.colors.split(',').map((c) => c.trim()).filter(Boolean),
      variantLabel: f.hasVariants ? variantLabel : '', variants: f.hasVariants ? variants : [],
      images: f.images,
    };
    try {
      await api(f.id ? `/admin/products/${f.id}` : '/admin/products', { token, method: f.id ? 'PUT' : 'POST', body });
      setF(BLANK);
      setListPage(1);
      setView('manage');
      setRefreshKey((value) => value + 1);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  const edit = (p) => {
    const savedVariantLabel = p.variantLabel || '';
    const normalizedVariantLabel = savedVariantLabel.trim().toLocaleLowerCase();
    const variantKind = normalizedVariantLabel === 'color' || normalizedVariantLabel === 'colour'
      ? 'Color'
      : ['shape', 'design', 'shape / design'].includes(normalizedVariantLabel) ? 'Shape / design' : 'custom';
    setF({
      id: p._id, name: p.name, price: (p.price / 100).toFixed(2), salePrice: p.salePrice != null ? (p.salePrice / 100).toFixed(2) : '', unitCost: Number.isFinite(p.unitCost) ? (p.unitCost / 100).toFixed(2) : '', stock: String(p.stock), category: categories.find((category) => category.name.toLocaleLowerCase() === (p.category || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase())?.name || '',
      colors: (p.colors || []).join(', '), hasVariants: Boolean(p.variants?.length), variantKind,
      variantLabel: variantKind === 'custom' ? savedVariantLabel : '', variants: (p.variants || []).join(', '),
      images: p.images || [], description: p.description || '',
    });
    setErr('');
    setView('add');
  };

  function remove(p) {
    setConfirmationError('');
    setConfirmation({ type: 'product', item: p });
  }

  async function confirmRemoval() {
    if (!confirmation || confirmationBusy) return;
    const stockChange = Number(stockDelta);
    if (confirmation.type === 'stock' && (!Number.isInteger(stockChange) || stockChange === 0)) {
      setConfirmationError('Enter a non-zero whole number. Use a positive number to add stock or a negative number to subtract it.');
      return;
    }
    setConfirmationBusy(true);
    setConfirmationError('');
    try {
      if (confirmation.type === 'category') {
        const category = confirmation.item;
        await api('/admin/categories/' + category._id, { token, method: 'DELETE' });
        setCategoryError('');
        setCategories((current) => current.filter((item) => item._id !== category._id));
        setF((current) => current.category === category.name ? { ...current, category: '' } : current);
        setCategoryRefreshKey((value) => value + 1);
      } else if (confirmation.type === 'product') {
        const product = confirmation.item;
        await api('/admin/products/' + product._id, { token, method: 'DELETE' });
        setErr('');
        if (list.length === 1 && listPage > 1) setListPage((value) => value - 1);
        setRefreshKey((value) => value + 1);
      } else {
        const product = confirmation.item;
        await api(`/admin/products/${product._id}/stock`, { token, method: 'PATCH', body: { delta: stockChange } });
        setErr('');
        setRefreshKey((value) => value + 1);
      }
      setConfirmation(null);
    } catch (error) {
      setConfirmationError(error.message);
    } finally {
      setConfirmationBusy(false);
    }
  }

  function adjustStock(product) {
    setStockDelta('1');
    setConfirmationError('');
    setConfirmation({ type: 'stock', item: product });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>
      <div role="group" aria-label="Product administration views" className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          type="button"
          id="product-add-tab"
          aria-pressed={view === 'add'}
          onClick={() => setView('add')}
          className={`btn ${view === 'add' ? 'btn-primary' : 'btn-ghost'}`}
        >{f.id ? 'Edit product' : 'Add new product'}</button>
        <button
          type="button"
          id="product-manage-tab"
          aria-pressed={view === 'manage'}
          onClick={() => setView('manage')}
          className={`btn ${view === 'manage' ? 'btn-primary' : 'btn-ghost'}`}
        >Manage products ({listTotal})</button>
      </div>

      {view === 'add' && <section id="product-add-panel" aria-labelledby="product-add-tab">
      <form onSubmit={save} className="space-y-3 card">
        <h2 className="font-semibold">{f.id ? 'Edit product' : 'Add product'}</h2>
        <input required placeholder="Name" {...bind('name')} className={input} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input required type="number" step="0.01" min="0" placeholder="Regular price (EGP)" {...bind('price')} className={input} />
          <input aria-label="Sale price in EGP (optional)" type="number" step="0.01" min="0" placeholder="Sale price (optional)" {...bind('salePrice')} className={input} />
          <input aria-label="Unit cost in EGP (optional)" type="number" step="0.01" min="0" placeholder="Unit cost (for profit)" {...bind('unitCost')} className={input} />
          <label className="space-y-1">
            <input required type="number" min="0" placeholder="Stock" {...bind('stock')} disabled={Boolean(f.id)} className={input} />
            {f.id && <span className="block text-xs text-stone-500">Adjust existing stock from Manage products.</span>}
          </label>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1">
            <span className="text-sm font-medium">Product category</span>
            <select required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={input}>
              <option value="">Choose a category</option>
              {categories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1">
            <span className="text-sm font-medium">Colors</span>
            <input placeholder="Comma separated, e.g. rose, sage" {...bind('colors')} className={input} />
          </label>
        </div>
        <section className="space-y-3 rounded-xl border border-stone-200 bg-white/60 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 accent-rose-700"
              checked={f.hasVariants}
              onChange={(event) => setF((current) => ({
                ...current,
                hasVariants: event.target.checked,
                ...(!event.target.checked ? { variantLabel: '', variants: '' } : {}),
              }))}
            />
            <span>
              <span className="block text-sm font-semibold">This product has selectable variants</span>
              <span className="block text-xs text-stone-600">Customers must choose the exact color or design before adding it to their cart.</span>
            </span>
          </label>
          {f.hasVariants && <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1">
              <span className="text-sm font-medium">Variant type</span>
              <select value={f.variantKind} onChange={(event) => setF((current) => ({ ...current, variantKind: event.target.value }))} className={input}>
                <option value="Color">Color</option>
                <option value="Shape / design">Shape / design</option>
                <option value="custom">Other (custom label)</option>
              </select>
            </label>
            {f.variantKind === 'custom' && <label className="min-w-0 space-y-1">
              <span className="text-sm font-medium">Custom variant label</span>
              <input required placeholder="e.g. Animal face" {...bind('variantLabel')} className={input} />
            </label>}
            <label className="min-w-0 space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">Choices customers can select</span>
              <input required placeholder={f.variantKind === 'Color' ? 'e.g. Rose, Sage, Cream' : 'e.g. Bear, Panda, Bunny'} {...bind('variants')} className={input} />
            </label>
            <p className="text-xs text-stone-600 sm:col-span-2">Separate choices with commas. The selected {f.variantKind === 'custom' ? (f.variantLabel.trim() || 'option') : f.variantKind.toLocaleLowerCase()} is saved with the cart and order for preparation. Choices share this product’s stock count.</p>
          </div>}
        </section>
        <details className="rounded-xl border border-stone-200 p-3">
          <summary className="cursor-pointer font-medium">Manage product categories</summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-stone-600">Add categories to the product selector and storefront filters. Reassign a category’s products before deleting it.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                maxLength={40}
                placeholder="New category name"
                aria-label="New category name"
                className={input}
              />
              <button type="button" onClick={addCategory} disabled={categoryBusy || categoryName.trim().length < 2} className="btn btn-ghost whitespace-nowrap">Add category</button>
            </div>
            {categoryError && <p role="alert" className="text-sm text-red-700">{categoryError}</p>}
            {categoryLoading && <p role="status" className="text-sm text-stone-500">Loading categories...</p>}
            {!categoryLoading && !categoryError && categories.length === 0 && <p className="text-sm text-stone-500">No categories yet. Add one above.</p>}
            {categories.length > 0 && (
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category._id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-sm">
                    <span>{category.name} <span className="text-stone-500">({category.productCount} products)</span></span>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category)}
                      disabled={categoryBusy || category.productCount > 0}
                      title={category.productCount > 0 ? 'Reassign its products before deleting this category.' : 'Delete category'}
                      className="cursor-pointer text-red-700 underline disabled:cursor-not-allowed disabled:opacity-40"
                    >Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
        <ImageUploader images={f.images} onChange={(images) => setF((cur) => ({ ...cur, images }))} />
        <textarea placeholder="Description" {...bind('description')} className={input} />
        {err && <p className="text-red-700">{err}</p>}
        <button className="btn btn-primary">{f.id ? 'Save changes' : 'Add product'}</button>
        {f.id && <button type="button" onClick={() => { setF(BLANK); setErr(''); setView('manage'); }} className="ml-2 underline">Cancel</button>}
      </form>
      </section>}

      {view === 'manage' && <section id="product-manage-panel" aria-labelledby="product-manage-tab" className="card space-y-4" aria-busy={loadingList}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Manage products</h2>
            <p className="text-sm text-stone-600">Edit product details or remove a product from the store.</p>
          </div>
          <button type="button" onClick={() => { setF(BLANK); setErr(''); setView('add'); }} className="btn btn-primary whitespace-nowrap">Add new product</button>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-stone-600">
          <span>Showing {list.length} of {listTotal} products</span>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="cursor-pointer underline">Refresh</button>
        </div>
        {err && <p role="alert" className="text-red-700">{err}</p>}
        {listError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">Could not load products: {listError}</p>}
        {loadingList && <p role="status" className="text-stone-600">Loading products...</p>}
        {!loadingList && !listError && list.length === 0 && <p className="card text-stone-600">No products found yet.</p>}
        <div className="space-y-3">
        {list.map((p) => (
          <div key={p._id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/80 p-3">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-stone-600">
                <ProductPrice product={p} /> · {p.stock > 0 ? p.stock + ' in stock' : 'Sold out (reservations only)'}{Number.isFinite(p.unitCost) ? ` · Cost ${money(p.unitCost)}` : ' · Cost not set'}
              </p>
              {p.variants?.length > 0 && <p className="text-sm text-stone-500">{p.variantLabel || 'Options'}: {p.variants.join(', ')} · shared stock</p>}
            </div>
            <div className="flex gap-3 text-sm">
              <button type="button" onClick={() => adjustStock(p)} className="cursor-pointer underline">Adjust stock</button>
              <button type="button" onClick={() => edit(p)} className="cursor-pointer underline">Edit</button>
              <button type="button" onClick={() => remove(p)} className="cursor-pointer text-red-700 underline">Delete</button>
            </div>
          </div>
        ))}
        </div>
        {listPages > 1 && <div className="flex items-center justify-center gap-4 text-sm">
          <button type="button" className="cursor-pointer underline disabled:cursor-not-allowed disabled:text-stone-400" disabled={listPage <= 1 || loadingList} onClick={() => setListPage((value) => value - 1)}>← Previous</button>
          <span>Page {listPage} of {listPages}</span>
          <button type="button" className="cursor-pointer underline disabled:cursor-not-allowed disabled:text-stone-400" disabled={listPage >= listPages || loadingList} onClick={() => setListPage((value) => value + 1)}>Next →</button>
        </div>}
      </section>}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.type === 'product' ? 'Delete this product?' : confirmation?.type === 'category' ? 'Delete this category?' : 'Adjust product stock'}
        description={confirmation?.type === 'stock' ? `Set how many items to add or remove for ${confirmation.item.name}.` : undefined}
        itemName={confirmation?.item?.name || ''}
        itemType={confirmation?.type}
        confirmLabel={confirmation?.type === 'product' ? 'Delete product' : confirmation?.type === 'category' ? 'Delete category' : 'Update stock'}
        cancelLabel={confirmation?.type === 'stock' ? 'Cancel' : 'Keep it'}
        busyLabel={confirmation?.type === 'stock' ? 'Updating…' : 'Removing…'}
        inputLabel={confirmation?.type === 'stock' ? 'Stock change' : undefined}
        inputHint={confirmation?.type === 'stock' ? 'Positive adds stock · negative removes stock · zero is not allowed.' : undefined}
        inputValue={confirmation?.type === 'stock' ? stockDelta : undefined}
        onInputChange={(value) => { setStockDelta(value); setConfirmationError(''); }}
        confirmStyle={confirmation?.type === 'stock' ? 'primary' : 'danger'}
        busy={confirmationBusy}
        error={confirmationError}
        onConfirm={confirmRemoval}
        onCancel={() => { if (!confirmationBusy) { setConfirmation(null); setConfirmationError(''); } }}
      />
    </div>
  );
}
