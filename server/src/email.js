// Transactional emails. Without SMTP settings they are printed to the console, so the flow can be tested locally.
let transport = null;
if (process.env.SMTP_HOST) {
  const { default: nodemailer } = await import('nodemailer');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const seller = () => process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
const site = () => process.env.CLIENT_URL;
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); // customer text goes into HTML
const money = (piasters) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: (process.env.CURRENCY || 'EGP').toUpperCase() }).format(piasters / 100);

async function send(to, subject, html) {
  if (!to) return;
  if (!transport) {
    const text = html.replace(/<a href="([^"]+)"[^>]*>/g, '$1 ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return console.log(`[email not sent: SMTP not configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
  }
  await transport.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, html, replyTo: seller() });
}
// A failed email must never break an order, so errors are logged instead of thrown.
const notify = (to, subject, html) => send(to, subject, html).catch((e) => console.error('Email failed:', e.message));

const shell = (heading, inner, cta) => `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#121411">
  <h1 style="color:#cd2221;font-size:22px">🧶 Stringtopia</h1>
  <h2 style="font-size:18px">${heading}</h2>
  ${inner}
  ${cta ? `<p><a href="${cta.url}" style="display:inline-block;background:#cd2221;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none;font-weight:700">${cta.label}</a></p>` : ''}
  <p style="color:#777;font-size:12px">Questions? Just reply to this email.</p>
</div>`;

const items = (o) =>
  `<ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}${i.variant ? ` (${esc(i.variantLabel || 'Option')}: ${esc(i.variant)})` : ''}</li>`).join('')}</ul><p><b>Total: ${money(o.total)}</b></p>`;

const where = (o) => {
  const d = o.delivery || {};
  if (d.method === 'pickup') return `<p>📍 Pick up at: ${esc(process.env.PICKUP_ADDRESS)}</p>`;
  if (d.method !== 'delivery') return '';
  const a = d.address || {};
  return `<p>${d.gift ? '🎁 Gift for' : '🚚 Delivering to'} ${esc(d.recipientName)}<br>${esc([a.line1, a.line2, a.city, a.postalCode, a.country].filter(Boolean).join(', '))}</p>`;
};
// Account holders see their orders page; guests get the private confirmation page.
const orderLink = (o) => (o.user ? `${site()}/orders` : `${site()}/thanks?ref=${o.publicToken}`);

export const mail = {
  requestReceived: (o) => notify(o.email, 'We received your reservation request',
    shell('Request received', `<p>Thank you! We will let you know soon whether we can make this for you. You only pay if we approve it.</p>${items(o)}${where(o)}`,
      { url: orderLink(o), label: 'View my requests' })),

  newRequest: (o) => notify(seller(), 'New reservation request',
    shell('New reservation request', `${items(o)}${o.note ? `<p>Customer note: ${esc(o.note)}</p>` : ''}`,
      { url: `${site()}/admin`, label: 'Review it' })),

  orderPlaced: (o) => {
    const isInstaPay = o.paymentMethod === 'instapay';
    const instructions = isInstaPay
      ? `<p>Please transfer ${money(o.total)} using InstaPay to <b>${esc(process.env.INSTAPAY_ACCOUNT_NAME || 'Stringtopia')}</b> at <b>${esc(process.env.INSTAPAY_ADDRESS)}</b>. Add this order reference to the transfer: <b>${String(o.id).toUpperCase()}</b>. We will confirm it by email.</p>`
      : `<p>Your order is placed. Please pay ${money(o.total)} in cash ${o.delivery?.method === 'pickup' ? 'when you collect it' : 'when it arrives'}.</p>`;
    notify(o.email, 'Your Stringtopia order is placed',
      shell(isInstaPay ? 'Complete your InstaPay transfer' : 'Order placed', `${instructions}${items(o)}${where(o)}`,
        { url: orderLink(o), label: 'View my order' }));
    notify(seller(), `New ${isInstaPay ? 'InstaPay' : 'cash-on-delivery'} order (${money(o.total)})`,
      shell('New order awaiting payment', `${instructions}${items(o)}${where(o)}`, { url: `${site()}/admin/orders`, label: 'Open orders' }));
  },

  instapayReferenceSubmitted: (o) => notify(seller(), `InstaPay reference submitted (${money(o.total)})`,
    shell('Check an InstaPay transfer', `<p>Order ${String(o.id).toUpperCase()} submitted transfer reference <b>${esc(o.instaPayReference)}</b>.</p>${items(o)}${where(o)}`,
      { url: `${site()}/admin/orders`, label: 'Open orders' })),

  codCompleted: (o) => notify(o.email, 'Your Stringtopia order is complete',
    shell('Thank you! 🧶', `<p>Your cash-on-delivery order has been delivered and payment received.</p>${items(o)}${where(o)}`,
      { url: orderLink(o), label: 'View my order' })),
  outForDelivery: (o) => notify(o.email, 'Your Stringtopia order is out for delivery',
    shell('Your order is on its way', `<p>Your crochet order is out for delivery. Please have the cash ready for the courier.</p>${items(o)}${where(o)}`,
      { url: orderLink(o), label: 'View my order' })),
  cancelled: (o) => {
    const cancellationReason = o.cancellationReason
      ? `<p><b>Cancellation reason:</b> ${esc(o.cancellationReason)}</p>`
      : '';
    const refundMessage = o.refundStatus === 'refunded'
      ? `<p>Your order was cancelled and a full refund of <b>${money(o.refundAmount || o.total)}</b> was confirmed. Your bank or payment provider may take time to post it.</p>`
      : o.refundStatus === 'processing'
        ? `<p>Your order was cancelled and a full refund of <b>${money(o.refundAmount || o.total)}</b> was submitted to Paymob. Your bank or payment provider may take time to post it.</p>`
        : o.refundStatus === 'manual_required'
          ? `<p>Your order was cancelled. A full refund of <b>${money(o.refundAmount || o.total)}</b> is due and will be arranged manually because this payment method does not support automatic refunds through checkout.</p>`
          : o.refundStatus === 'failed'
            ? `<p>Your order was cancelled, but the automatic refund request could not be completed. Stringtopia has been alerted and will arrange the full refund of <b>${money(o.refundAmount || o.total)}</b>.</p>`
            : '<p>Your order was cancelled before payment was received. Any held items have been returned to stock.</p>';
    notify(o.email, 'Your Stringtopia order was cancelled',
      shell('Order cancelled', `${refundMessage}${cancellationReason}${items(o)}${where(o)}`,
        { url: orderLink(o), label: 'View my order' }));
  },

  refunded: (o) => notify(o.email, 'Your Stringtopia refund was confirmed',
    shell('Your refund is on its way', `<p>Paymob confirmed a full refund of <b>${money(o.refundAmount || o.total)}</b> for your cancelled order. Your bank or payment provider may take time to post it.</p>${items(o)}`,
      { url: orderLink(o), label: 'View my order' })),

  refundSubmitted: (o) => notify(o.email, 'Your Stringtopia refund was submitted',
    shell('Your refund is being processed', `<p>A full refund of <b>${money(o.refundAmount || o.total)}</b> was submitted to Paymob for your cancelled order. Your bank or payment provider may take time to post it.</p>${items(o)}`,
      { url: orderLink(o), label: 'View my order' })),

  latePaymentRefund: (o) => notify(o.email, 'Payment received after order cancellation',
    shell('We found a payment for your cancelled order', `<p>Paymob confirmed a payment of <b>${money(o.refundAmount || o.total)}</b> after the order was cancelled. A full refund was submitted automatically. Your bank or payment provider may take time to post it.</p>${items(o)}`,
      { url: orderLink(o), label: 'View my order' })),

  refundFailed: (o) => notify(o.email, 'We are arranging your Stringtopia refund',
    shell('Your refund needs a little help', `<p>We cancelled your order, but could not submit the full refund of <b>${money(o.refundAmount || o.total)}</b> automatically. Stringtopia has been alerted and will arrange it for you.</p>${items(o)}`,
      { url: orderLink(o), label: 'View my order' })),
  approved: (o) => notify(o.email, 'Your reservation is approved',
    shell('Approved! We can make it for you',
      `<p>${o.eta ? `Estimate: <b>${esc(o.eta)}</b>. ` : ''}Please pay by ${new Intl.DateTimeFormat('en-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(o.expiresAt)} Cairo time to confirm your order.</p>${items(o)}${where(o)}`,
      { url: `${site()}/pay/${o.publicToken}`, label: 'Pay now' })),

  declined: (o) => notify(o.email, 'About your reservation request',
    shell('We cannot make this one', `<p>We are not able to take this request${o.declineReason ? `: ${esc(o.declineReason)}` : '.'}</p>${items(o)}`,
      { url: site(), label: 'Browse other pieces' })),

  expired: (o) => {
    const directOrder = ['instapay', 'cod'].includes(o.paymentMethod);
    const title = directOrder ? 'Your order has expired' : 'Your reservation has expired';
    const message = directOrder
      ? 'We could not complete this order in time, so the items have been returned to stock. You are welcome to place a new order.'
      : o.expiresAt ? 'The payment window for your approved reservation has passed.' : 'We were not able to get to your request in time.';
    notify(o.email, title,
      shell(title, `<p>${message}</p>${items(o)}`, { url: site(), label: 'Back to the shop' }));
  },

  paid: (o) => {
    notify(o.email, 'Your Stringtopia order is confirmed',
      shell('Thank you for your order', `<p>We have your payment and will start preparing it.</p>${items(o)}${where(o)}`,
        { url: orderLink(o), label: 'View my order' }));
    notify(seller(), `New paid order (${money(o.total)})`,
      shell('New paid order', `${items(o)}${where(o)}`, { url: `${site()}/admin/orders`, label: 'Open orders' }));
  },

  problem: (o, text) => notify(seller(), 'An order needs your attention',
    shell('Order needs your attention', `<p>${esc(text)}</p>${items(o)}`, { url: `${site()}/admin/orders`, label: 'Open orders' })),

  shipped: (o) => {
    const pickup = o.delivery?.method === 'pickup';
    notify(o.email, pickup ? 'Your order is ready for pickup' : 'Your order is on its way',
      shell(pickup ? 'Ready for pickup' : 'On its way', `${where(o)}${items(o)}`, { url: orderLink(o), label: 'View my order' }));
  },
};
