'use client';
import { useEffect, useState } from 'react';
import { api, money } from '@/lib/api';
import { useStore } from '@/components/Providers';
import ImageUploader from '@/components/ImageUploader';

const BLANK = { id: null, name: '', price: '', stock: '1', category: '', colors: '', images: [], description: '' };
const input = 'field w-full';

export default function AdminProducts() {
  const { token } = useStore();
  const [list, setList] = useState([]);
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState('');
  const load = () => api('/products?limit=50').then((d) => setList(d.products)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  async function save(e) {
    e.preventDefault();
    setErr('');
    const body = {
      name: f.name, description: f.description, category: f.category || undefined,
      price: Math.round(parseFloat(f.price) * 100), // dollars in the form, cents in the database
      stock: parseInt(f.stock, 10),
      colors: f.colors.split(',').map((c) => c.trim()).filter(Boolean),
      images: f.images,
    };
    try {
      await api(f.id ? `/products/${f.id}` : '/products', { token, method: f.id ? 'PUT' : 'POST', body });
      setF(BLANK);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  const edit = (p) => setF({
    id: p._id, name: p.name, price: (p.price / 100).toFixed(2), stock: String(p.stock), category: p.category || '',
    colors: (p.colors || []).join(', '), images: p.images || [], description: p.description || '',
  });

  async function remove(p) {
    if (!confirm(`Delete ${p.name}?`)) return;
    await api(`/products/${p._id}`, { token, method: 'DELETE' }).catch((ex) => setErr(ex.message));
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>
      <form onSubmit={save} className="space-y-2 card">
        <h2 className="font-semibold">{f.id ? 'Edit product' : 'Add product'}</h2>
        <input required placeholder="Name" {...bind('name')} className={input} />
        <div className="flex gap-2">
          <input required type="number" step="0.01" min="0" placeholder="Price (EGP)" {...bind('price')} className={input} />
          <input required type="number" min="0" placeholder="Stock" {...bind('stock')} className={input} />
        </div>
        <div className="flex gap-2">
          <input placeholder="Category (amigurumi, wearables, bags)" {...bind('category')} className={input} />
          <input placeholder="Colors (comma separated)" {...bind('colors')} className={input} />
        </div>
        <ImageUploader images={f.images} onChange={(images) => setF((cur) => ({ ...cur, images }))} />
        <textarea placeholder="Description" {...bind('description')} className={input} />
        {err && <p className="text-red-700">{err}</p>}
        <button className="btn btn-primary">{f.id ? 'Save changes' : 'Add product'}</button>
        {f.id && <button type="button" onClick={() => setF(BLANK)} className="ml-2 underline">Cancel</button>}
      </form>
      {list.map((p) => (
        <div key={p._id} className="flex items-center justify-between card">
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-stone-600">
              {money(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : 'Sold out (reservations only)'}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <button onClick={() => edit(p)} className="underline">Edit</button>
            <button onClick={() => remove(p)} className="text-red-700 underline">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
