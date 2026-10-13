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
const money = (cents) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: (process.env.CURRENCY || 'EGP').toUpperCase() }).format(cents / 100);

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
  `<ul>${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join('')}</ul><p><b>Total: ${money(o.total)}</b></p>`;

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

  approved: (o) => notify(o.email, 'Your reservation is approved',
    shell('Approved! We can make it for you',
      `<p>${o.eta ? `Estimate: <b>${esc(o.eta)}</b>. ` : ''}Please pay by ${o.expiresAt.toUTCString()} to confirm your order.</p>${items(o)}${where(o)}`,
      { url: `${site()}/pay/${o.publicToken}`, label: 'Pay now' })),

  declined: (o) => notify(o.email, 'About your reservation request',
    shell('We cannot make this one', `<p>We are not able to take this request${o.declineReason ? `: ${esc(o.declineReason)}` : '.'}</p>${items(o)}`,
      { url: site(), label: 'Browse other pieces' })),

  expired: (o) => notify(o.email, 'Your reservation has expired',
    shell('Reservation expired',
      `<p>${o.expiresAt ? 'The payment window for your approved reservation has passed.' : 'We were not able to get to your request in time.'} You are welcome to send a new request.</p>${items(o)}`,
      { url: site(), label: 'Back to the shop' })),

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
