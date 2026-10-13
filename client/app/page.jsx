import Link from 'next/link';
import { api } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import BrandArtwork from '@/components/BrandArtwork';

const CATEGORIES = ['Keychains', 'Amigurumi', 'Bags', 'Baby & Kids', 'Home & Lifestyle', 'Wearables', 'Collections', 'Custom'];
const pill = (on) => `pill ${on ? 'pill-on' : ''}`;

// Server-rendered so Google can index the catalog.
export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const clean = (o) => new URLSearchParams(
    Object.entries(o).flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.filter((item) => item !== undefined && item !== null && item !== '').map((item) => [key, String(item)]);
    }),
  );
  const first = (value) => Array.isArray(value) ? value[0] : value;
  const apiParams = { ...sp };
  for (const [formKey, apiKey] of [['minPrice', 'min'], ['maxPrice', 'max']]) {
    const rawValue = first(sp[formKey]);
    if (rawValue !== undefined && rawValue !== '') {
      const amount = Number(rawValue);
      if (Number.isFinite(amount) && amount >= 0) apiParams[apiKey] = String(Math.round(amount * 100));
      else delete apiParams[apiKey];
    }
    delete apiParams[formKey];
  }
  const { products, page, pages, total } = await api(`/products?${clean(apiParams)}`);
  const link = (patch) => `/?${clean({ ...sp, ...patch })}`;

  return (
    <>
      <section className="mb-8 grid items-center gap-6 md:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-5xl font-bold leading-none md:text-6xl">Crochet made by hand, one loop at a time.</h1>
          <p className="mt-3 max-w-md text-lg">
            Buy what is in stock and we send it to you or to a friend. Found something sold out? Ask us to make it for you.
          </p>
        </div>
        <BrandArtwork src="/stringtopia.jpg" alt="Stringtopia's teddy bear king, holding a crochet hook on a hill of yarn" className="hero-art w-full" />
      </section>
      <form className="catalog-search" method="get">
        <div className="catalog-search-main">
          <label className="catalog-search-field">
            <span className="sr-only">Search Stringtopia products</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="catalog-search-icon" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              id="catalog-search" type="search" name="q" defaultValue={first(sp.q)}
              placeholder="Find your next handmade favorite..." className="catalog-search-input"
            />
            <span className="catalog-search-hint" aria-hidden="true">stitched with love</span>
          </label>
          {first(sp.category) && <input type="hidden" name="category" value={first(sp.category)} />}
          <label className="catalog-sort">
            <span className="sr-only">Sort products</span>
            <select name="sort" defaultValue={first(sp.sort) || ''} className="field catalog-sort-select">
              <option value="">Newest</option>
              <option value="price">Price: low to high</option>
              <option value="-price">Price: high to low</option>
            </select>
          </label>
          <button className="btn btn-primary catalog-search-button">
            <span aria-hidden="true">✦</span> Find it
          </button>
        </div>
        <div className="catalog-search-filters" role="group" aria-label="Filter products">
          <label className="catalog-price-filter">
            <span>Min price <span className="catalog-currency">EGP</span></span>
            <input className="field catalog-price-input" type="number" name="minPrice" min="0" step="0.01" inputMode="decimal" placeholder="Any" defaultValue={first(sp.minPrice)} />
          </label>
          <label className="catalog-price-filter">
            <span>Max price <span className="catalog-currency">EGP</span></span>
            <input className="field catalog-price-input" type="number" name="maxPrice" min="0" step="0.01" inputMode="decimal" placeholder="Any" defaultValue={first(sp.maxPrice)} />
          </label>
          <label className="catalog-stock-filter">
            <input type="checkbox" name="inStock" value="true" defaultChecked={first(sp.inStock) === 'true'} />
            <span>In stock only</span>
          </label>
          <Link href="/" className="catalog-clear-filters">Clear filters</Link>
        </div>
      </form>

      <p className="mb-3 text-sm text-stone-600" aria-live="polite">{total} {total === 1 ? 'handmade find' : 'handmade finds'}</p>
      <div className="yarn-cycle mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={link({ category: '', page: '' })} className={pill(!sp.category)}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={link({ category: c, page: '' })} className={pill(sp.category === c)}>{c}</Link>
        ))}
      </div>

      <div className="yarn-cycle grid grid-cols-2 gap-4 md:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
      {!products.length && <p>No pieces found.</p>}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={link({ page: page - 1 })} className="catalog-pagination-link">← Prev</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={link({ page: page + 1 })} className="catalog-pagination-link">Next →</Link>}
        </div>
      )}
    </>
  );
}
