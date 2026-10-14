import { notFound } from 'next/navigation';
import { api, img } from '@/lib/api';
import Gallery from '@/components/Gallery';
import BuyBox from '@/components/BuyBox';
import FavoriteButton from '@/components/FavoriteButton';
import ProductPrice from '@/components/ProductPrice';

const get = (slug) => api(`/products/${slug}`).catch(() => null);

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
  return (
    <div className="grid gap-6 md:grid-cols-2">
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
