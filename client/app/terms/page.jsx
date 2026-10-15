import Link from 'next/link';

export const metadata = {
  title: 'Terms of sale | Stringtopia',
  description: 'Terms for browsing and ordering handmade crochet from Stringtopia.',
};

const updated = '15 October 2026';
const whatsapp = 'https://wa.me/201123611242';
const email = 'mailto:tasneemmohamed2013@gmail.com';

export default function TermsPage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="empty-cart-kicker">Stringtopia · Shopping information</p>
        <h1 className="text-3xl font-bold">Terms of sale</h1>
        <p className="text-sm text-stone-600">Last updated {updated}</p>
        <p>These terms explain how orders through Stringtopia work. By placing an order, you confirm that the contact and delivery details you provide are accurate.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Products and availability</h2>
        <p>Stringtopia items are handmade. Small differences in stitch, shape, or color can occur between pieces and screens; product descriptions and selected variants identify the item you are ordering. Photos and product descriptions are provided to help you choose. Stock and listings can change, and we will contact you if we cannot fulfill an order as placed.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Prices, discounts, and payment</h2>
        <p>The product prices, any active sale price, delivery fee, promo discount, and total shown at checkout apply to that order. Promo codes are subject to their displayed eligibility, dates, and usage limits.</p>
        <p>Available payment options may include cash on delivery or pickup, InstaPay, and Paymob. Paymob card payments continue on Paymob’s checkout page. For InstaPay, you may submit a transfer reference or choose to send proof through WhatsApp. An order paid by cash is due at delivery or collection. We confirm an InstaPay order after checking the transfer.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Delivery, pickup, and order messages</h2>
        <p>Delivery and pickup choices, address, and any delivery charge are shown or confirmed during checkout. We use the contact details you provide to coordinate fulfillment and send order updates. If a recipient is different from the person ordering, make sure you have permission to provide that recipient’s details.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Cancellations, returns, and problems</h2>
        <p>For eligible account orders in requested, pending, or approved status, the My Orders page provides a cancellation option for up to three days after the order is placed. The option may be unavailable after the order changes status or the period ends. If you need help, contact us. When a Paymob refund is due, Stringtopia will request it through Paymob or arrange it manually if the automatic request fails. Your bank may take additional time to post it.</p>
        <p>The three-day website cancellation feature does not limit any return, exchange, refund, or remedy that applies under consumer-protection law. If an item arrives damaged, incorrect, or you want to ask about a return or exchange, contact Stringtopia promptly so we can help under the rules that apply to your order.</p>
        <p>For official consumer guidance in Egypt, see the <a href="https://cpa.gov.eg/ar-eg/%D8%A7%D8%B3%D8%A6%D9%84%D8%A9-%D9%85%D8%AA%D9%83%D8%B1%D8%B1%D8%A9" target="_blank" rel="noopener noreferrer" className="font-medium text-yarn underline underline-offset-2">Consumer Protection Agency FAQs</a>.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Accounts and external services</h2>
        <p>You are responsible for keeping your sign-in credentials secure and for activity on your account. Google sign-in, Paymob, and WhatsApp are third-party services; when you choose them, their own terms and privacy policies also apply.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Photos and other creative work</h2>
        <p>Stringtopia product photos may be downloaded and shared for non-commercial purposes when Stringtopia is clearly credited and the images are not altered. Do not claim the photos as your own or use them commercially without written permission. See the <Link href="/asset-rights" className="font-medium text-yarn underline underline-offset-2">Asset &amp; usage rights</Link> page for the full notice.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Changes and contact</h2>
        <p>We may update these terms as the shop changes. The latest revision date appears above. These terms do not remove rights that cannot be waived under applicable law.</p>
        <p>Questions about an order? Email <a className="font-medium text-yarn underline underline-offset-2" href={email}>tasneemmohamed2013@gmail.com</a> or message <a className="font-medium text-yarn underline underline-offset-2" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp +20 112 361 1242</a>.</p>
      </section>

      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/privacy" className="font-medium text-yarn underline underline-offset-2">Privacy policy</Link>
        <Link href="/asset-rights" className="font-medium text-yarn underline underline-offset-2">Asset &amp; usage rights</Link>
        <Link href="/" className="font-medium text-yarn underline underline-offset-2">Back to the shop</Link>
      </nav>
    </article>
  );
}
