'use client';

import { useRef, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { api } from '@/lib/api';

const pill = (on) => `pill cursor-pointer ${on ? 'pill-on' : ''}`;

export default function CatalogBrowser({ initialProducts, initialPage, initialPages, initialTotal, initialFilters, categories }) {
  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState({ products: initialProducts, page: initialPage, pages: initialPages, total: initialTotal });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  async function refreshGallery(nextFilters, page = 1) {
    const currentRequest = ++requestId.current;
    const apiParams = new URLSearchParams();
    const urlParams = new URLSearchParams();
    const q = nextFilters.q.trim();
    const category = nextFilters.category.trim();
    if (q) { apiParams.set('q', q); urlParams.set('q', q); }
    if (category) { apiParams.set('category', category); urlParams.set('category', category); }
    if (nextFilters.sort) { apiParams.set('sort', nextFilters.sort); urlParams.set('sort', nextFilters.sort); }
    for (const [formKey, apiKey] of [['minPrice', 'min'], ['maxPrice', 'max']]) {
      const rawValue = nextFilters[formKey];
      if (rawValue === '') continue;
      const amount = Number(rawValue);
      if (Number.isFinite(amount) && amount >= 0) {
        apiParams.set(apiKey, String(Math.round(amount * 100)));
        urlParams.set(formKey, String(amount));
      }
    }
    if (nextFilters.inStock) { apiParams.set('inStock', 'true'); urlParams.set('inStock', 'true'); }
    if (page > 1) { apiParams.set('page', String(page)); urlParams.set('page', String(page)); }

    setLoading(true);
    setError('');
    try {
      const data = await api(`/products?${apiParams.toString()}`);
      if (currentRequest !== requestId.current) return;
      setResults(data);
      const query = urlParams.toString();
      window.history.replaceState(null, '', query ? `/?${query}` : '/');
    } catch (searchError) {
      if (currentRequest === requestId.current) setError(searchError.message || 'We could not refresh the products.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void refreshGallery(filters);
  }
  function handleStockChange(event) {
    const nextFilters = { ...filters, inStock: event.target.checked };
    setFilters(nextFilters);
    void refreshGallery(nextFilters);
  }
  function handleCategory(category) {
    const nextFilters = { ...filters, category };
    setFilters(nextFilters);
    void refreshGallery(nextFilters);
  }
  function clearFilters() {
    const nextFilters = { q: '', category: '', sort: '', minPrice: '', maxPrice: '', inStock: false };
    setFilters(nextFilters);
    void refreshGallery(nextFilters);
  }

  return (
    <>
      <form className="catalog-search" onSubmit={handleSubmit}>
        <div className="catalog-search-main">
          <label className="catalog-search-field">
            <span className="sr-only">Search Stringtopia products</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="catalog-search-icon" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input id="catalog-search" type="search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Find your next handmade favorite..." className="catalog-search-input" />
            <span className="catalog-search-hint" aria-hidden="true">stitched with love</span>
          </label>
          <label className="catalog-sort">
            <span className="sr-only">Sort products</span>
            <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} className="field catalog-sort-select">
              <option value="">Newest</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option>
            </select>
          </label>
          <button className="btn btn-primary catalog-search-button" type="submit" disabled={loading}>
            <span aria-hidden="true">✦</span> {loading ? 'Finding...' : 'Find it'}
          </button>
        </div>
        <div className="catalog-search-filters" role="group" aria-label="Filter products">
          <label className="catalog-price-filter">
            <span>Min price <span className="catalog-currency">EGP</span></span>
            <input className="field catalog-price-input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Any" value={filters.minPrice} onChange={(event) => setFilters({ ...filters, minPrice: event.target.value })} />
          </label>
          <label className="catalog-price-filter">
            <span>Max price <span className="catalog-currency">EGP</span></span>
            <input className="field catalog-price-input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="Any" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} />
          </label>
          <label className="catalog-stock-filter">
            <input type="checkbox" checked={filters.inStock} onChange={handleStockChange} />
            <span>In stock only</span>
          </label>
          <button type="button" onClick={clearFilters} className="catalog-clear-filters">Clear filters</button>
        </div>
      </form>

      <p className="mb-3 text-sm text-stone-600" aria-live="polite">{results.total} {results.total === 1 ? 'handmade find' : 'handmade finds'}</p>
      <div className="yarn-cycle mb-4 flex flex-wrap gap-2 text-sm" aria-label="Product categories">
        <button type="button" onClick={() => handleCategory('')} className={pill(!filters.category)} aria-pressed={!filters.category}>All</button>
        {categories.map((category) => <button key={category} type="button" onClick={() => handleCategory(category)} className={pill(filters.category === category)} aria-pressed={filters.category === category}>{category}</button>)}
      </div>

      <div aria-busy={loading}>
        {error && <p className="mb-3 text-sm text-red-700" role="alert">{error}</p>}
        {loading && <p className="mb-3 text-sm text-stone-500" role="status">Finding your handmade favorites…</p>}
        <div className={`yarn-cycle grid grid-cols-2 gap-4 md:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {results.products.map((product) => <ProductCard key={product._id} product={product} />)}
        </div>
        {!loading && !results.products.length && <p className="mt-3">No pieces found.</p>}
      </div>

      {results.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {results.page > 1 && <button type="button" className="catalog-pagination-link cursor-pointer border-0 bg-transparent p-0" onClick={() => void refreshGallery(filters, results.page - 1)} disabled={loading}>← Prev</button>}
          <span>Page {results.page} of {results.pages}</span>
          {results.page < results.pages && <button type="button" className="catalog-pagination-link cursor-pointer" onClick={() => void refreshGallery(filters, results.page + 1)} disabled={loading}>Next →</button>}
        </div>
      )}
    </>
  );
}
