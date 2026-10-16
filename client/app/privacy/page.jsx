import Link from 'next/link';

export const metadata = {
  title: 'Privacy policy | Stringtopia',
  description: 'How Stringtopia collects, uses, and protects customer information.',
};

const updated = '16 October 2026';
const whatsapp = 'https://wa.me/201123611242';
const email = 'mailto:tasneemmohamed2013@gmail.com';

export default function PrivacyPage() {
  return (
    <article className="card mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="empty-cart-kicker">Stringtopia · Customer information</p>
        <h1 className="text-3xl font-bold">Privacy policy</h1>
        <p className="text-sm text-stone-600">Last updated {updated}</p>
        <p>This policy explains what information Stringtopia uses when you browse the shop, create an account, contact us, or place an order—including a guest order.</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Information we use</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Account details:</strong> your name, email address, password hash or Google account identifier, and saved favorites. We do not store your password in readable form.</li>
          <li><strong>Order details:</strong> customer and recipient names, phone numbers, email, delivery address or pickup choice, gift message, products and selected variants, order notes, totals, discount, payment method, and order status.</li>
          <li><strong>Payment status:</strong> an InstaPay transfer reference if you submit one, and payment-provider references and status needed to reconcile a Paymob transaction. Paymob handles card entry on its own checkout page; Stringtopia does not receive or store your full card number or security code.</li>
          <li><strong>Optional proof:</strong> if you choose to send an InstaPay screenshot, you send it to us through WhatsApp. That image is handled by WhatsApp/Meta as well as Stringtopia; it is not uploaded through this website.</li>
          <li><strong>Browser data:</strong> this site saves your cart in browser local storage. When you sign in, the server sets an HttpOnly, SameSite cookie named <code>st_session</code> to maintain your session; browser scripts cannot read this cookie. For checkout-abuse prevention, the server creates a keyed hash of the checkout IP address rather than saving the raw address in the order record.</li>
        </ul>
        <p>If you place an order by phone or WhatsApp, we may enter the details needed to manage that order into the store system.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How we use information</h2>
        <p>We use it to create and secure accounts, remember favorites and carts, process and fulfill orders, arrange delivery or pickup, verify payments, handle cancellations and refunds, send order emails, answer questions, prevent abuse, and meet applicable record-keeping obligations. We do not sell customer personal information.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Services that help run the shop</h2>
        <p>Information is shared only as needed with authorized Stringtopia administrators and service providers that support the shop: hosting and database providers, email delivery, Google when you choose Google sign-in, Paymob when you choose card checkout, and delivery providers when needed to fulfill an order. Product photos and store media are hosted through Cloudinary. If you choose WhatsApp for payment proof or support, WhatsApp/Meta processes that conversation under its own terms and privacy practices.</p>
        <p>Some service providers may process or store information outside Egypt. Any applicable cross-border transfer requirements and safeguards must be met for those transfers.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How long we keep information</h2>
        <p>Account deletion can be requested from <Link href="/account" className="font-medium text-yarn underline underline-offset-2">Account settings</Link> and takes effect after a 7-day grace period; you can cancel it there before the scheduled date. When deletion takes effect, we remove the account and favorites. We retain order details only as needed to fulfill an active order, resolve a refund, or meet applicable legal or accounting obligations, then remove or de-identify personal details when they are no longer needed.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your choices and requests</h2>
        <p>Depending on applicable law and the circumstances, you can ask to access or correct your information, request deletion or restriction, object to certain uses, or withdraw consent where processing relies on consent. Contact us using either channel below. We may need to verify your identity before acting, and some order records may need to be kept.</p>
        <p>For official information about Egypt’s personal data protection framework, visit the <a href="https://portal.pdpc.gov.eg/" target="_blank" rel="noopener noreferrer" className="font-medium text-yarn underline underline-offset-2">Personal Data Protection Center</a>.</p>
        <p>Keep your device secure and sign out on shared devices. Clearing browser local storage removes your saved cart but does not sign you out. Use Sign out in the site navigation or clear this site’s cookies to end your session.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact Stringtopia</h2>
        <p>For privacy questions or requests, contact us at <a className="font-medium text-yarn underline underline-offset-2" href={email}>tasneemmohamed2013@gmail.com</a> or <a className="font-medium text-yarn underline underline-offset-2" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp +20 112 361 1242</a>.</p>
      </section>

      <p className="text-sm text-stone-600">This notice may be updated as the shop changes. The date above shows the latest revision.</p>
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/terms" className="font-medium text-yarn underline underline-offset-2">Terms of sale</Link>
        <Link href="/asset-rights" className="font-medium text-yarn underline underline-offset-2">Asset &amp; usage rights</Link>
        <Link href="/" className="font-medium text-yarn underline underline-offset-2">Back to the shop</Link>
      </nav>
    </article>
  );
}
