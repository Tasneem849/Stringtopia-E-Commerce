'use client';

export default function ErrorPage({ reset }) {
  return (
    <section className="card mx-auto my-10 max-w-xl space-y-3 text-center" role="alert">
      <p className="text-4xl" aria-hidden="true">🧶</p>
      <h1 className="text-2xl font-bold">We hit a little snag</h1>
      <p className="text-stone-600">The shop couldn’t finish loading this page. Your cart is still safe.</p>
      <button type="button" onClick={() => reset()} className="btn btn-primary">Try again</button>
    </section>
  );
}
