import CatalogBrowser from '@/components/CatalogBrowser';
import { api } from '@/lib/api';

import BrandArtwork from '@/components/BrandArtwork';

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
  const [{ products, page, pages, total }, categories] = await Promise.all([
    api(`/products?${clean(apiParams)}`),
    api('/categories').catch(() => []),
  ]);

  const initialFilters = {
    q: String(first(sp.q) || ''), category: String(first(sp.category) || ''), sort: String(first(sp.sort) || ''),
    minPrice: String(first(sp.minPrice) || ''), maxPrice: String(first(sp.maxPrice) || ''),
    inStock: first(sp.inStock) === 'true',
  };

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
      <CatalogBrowser
        initialProducts={products} initialPage={page} initialPages={pages} initialTotal={total}
        initialFilters={initialFilters} categories={categories}
      />
    </>
  );
}
