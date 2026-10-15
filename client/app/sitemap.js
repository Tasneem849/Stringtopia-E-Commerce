import { api } from '@/lib/api';

export default async function sitemap() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const base = configuredSiteUrl.replace(/\/$/, '');
  let products = [];
  try {
    const first = await api('/products?limit=50&page=1', { revalidate: 3600, timeoutMs: 8000 });
    products = first.products || [];
    const remainingPages = Math.min(Math.max(0, Number(first.pages || 1) - 1), 99);
    if (remainingPages) {
      const pages = await Promise.all(Array.from({ length: remainingPages }, (_, index) =>
        api(`/products?limit=50&page=${index + 2}`, { revalidate: 3600, timeoutMs: 8000 }),
      ));
      products.push(...pages.flatMap((result) => result.products || []));
    }
  } catch {
    // Keep sitemap generation available during an API outage; product URLs repopulate on next revalidation.
  }
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/asset-rights`, changeFrequency: 'yearly', priority: 0.2 },
    ...products.filter((product) => product.slug).map((product) => ({ url: `${base}/products/${encodeURIComponent(product.slug)}`, changeFrequency: 'weekly', priority: 0.7 })),
  ];
}
