import Link from 'next/link';

export const metadata = {
  title: 'Asset & usage rights | Stringtopia',
  description: 'Usage rights for the Stringtopia project and its creative assets.',
};

export default function AssetRightsPage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-5">
      <p className="empty-cart-kicker">Stringtopia</p>
      <h1 className="text-3xl font-bold">Asset &amp; usage rights</h1>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Project structure</h2>
        <p>You may use the high-level project structure as a reference, including its folder organization and general separation between the client and server. This permission does not grant permission to copy or redistribute the source code.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Brand and creative assets</h2>
        <p>Stringtopia’s name, logo, illustrations, product photos, product descriptions, and other original creative assets are protected. You may download and share Stringtopia product photos for non-commercial purposes when you clearly credit Stringtopia and leave the images unaltered. Do not claim the photos as your own, remove their attribution, or use them commercially without written permission from the applicable rights holder. This limited permission does not transfer ownership. Third-party materials remain the property of their respective owners.</p>
      </section>

      <p className="text-sm text-stone-600">Public access to this website or repository does not grant permission to use its source code or creative assets.</p>
      <Link href="/" className="inline-block font-medium text-yarn underline underline-offset-2">Back to the shop</Link>
    </article>
  );
}
