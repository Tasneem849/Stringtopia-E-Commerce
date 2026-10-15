import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { api, img } from '@/lib/api';
import Gallery from '@/components/Gallery';
import BuyBox from '@/components/BuyBox';
import FavoriteButton from '@/components/FavoriteButton';
import ProductPrice from '@/components/ProductPrice';

const get = (slug) => api(`/products/${encodeURIComponent(slug)}`, { revalidate: 60, timeoutMs: 8000 }).catch((error) => {
  if (error.status === 404) return null;
  throw error;
});

export async function generateMetadata({ params }) {
  const p = await get((await params).slug);
  return {
    title: p ? `${p.name} | Stringtopia` : 'Not found',
    description: p?.description,
    openGraph: { images: p?.images?.[0] ? [img(p.images[0], 1200)] : [] }, // link previews (e.g. on Facebook)
  };
}

export default async function ProductPage({ params }) {
  const p = await get((await params).slug);
  if (!p) notFound();
  const nonce = (await headers()).get('x-nonce');
  const productJsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name,
    description: p.description, image: p.images || [], sku: p.slug,
    offers: { '@type': 'Offer', priceCurrency: process.env.NEXT_PUBLIC_CURRENCY || 'EGP', price: ((p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price) / 100).toFixed(2), availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <script nonce={nonce || undefined} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c') }} />
      <Gallery images={p.images} />
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-4xl font-bold">{p.name}</h1>
          <FavoriteButton product={p} />
        </div>
        <p className="my-2 text-xl text-yarn"><ProductPrice product={p} /></p>
        <p className="mb-4 text-stone-600">{p.description}</p>
        <BuyBox product={p} />
      </div>
    </div>
  );
}
