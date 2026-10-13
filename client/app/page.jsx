import Link from 'next/link';
import { api, money } from '@/lib/api';
import Thumb from '@/components/Thumb';

const CATEGORIES = ['Keychains', 'Amigurumi', 'Baby & Kids', 'Home & Lifestyle', 'Wearables', 'Collections', 'Custom'];
const pill = (on) => `pill ${on ? 'pill-on' : ''}`;

// Server-rendered so Google can index the catalog.
export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const clean = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v));
  const { products, page, pages } = await api(`/products?${clean(sp)}`);
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
        <img src="/stringtopia.jpg" alt="Stringtopia's teddy bear king, holding a crochet hook on a hill of yarn" className="hero-art w-full" />
      </section>
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search crochet..." className="field flex-1" />
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        <select name="sort" defaultValue={sp.sort || ''} className="field">
          <option value="">Newest</option>
          <option value="price">Price: low to high</option>
          <option value="-price">Price: high to low</option>
        </select>
        <button className="btn btn-primary">Go</button>
      </form>

      <div className="yarn-cycle mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={link({ category: '', page: '' })} className={pill(!sp.category)}>All</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={link({ category: c, page: '' })} className={pill(sp.category === c)}>{c}</Link>
        ))}
      </div>

      <div className="yarn-cycle grid grid-cols-2 gap-4 md:grid-cols-3">
        {products.map((p) => (
          <Link key={p._id} href={`/products/${p.slug}`} className="card card-lift">
            <Thumb src={p.images?.[0]} />
            <h2 className="mt-2 text-xl font-bold">{p.name}</h2>
            <p className="text-sm text-stone-600">
              {money(p.price)}
              {p.stock === 0 && <span className="chip">Sold out: reserve it</span>}
            </p>
          </Link>
        ))}
      </div>
      {!products.length && <p>No pieces found.</p>}

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={link({ page: page - 1 })}>← Prev</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={link({ page: page + 1 })}>Next →</Link>}
        </div>
      )}
    </>
  );
}
