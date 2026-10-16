// Finds out, in YOUR Paymob sandbox, what transaction inquiry returns for a payment that was never paid.
// The shop does not depend on this today; run it before adding any logic that would.
//
//   node scripts/paymob-inquiry-check.js         create a test payment, leave it unpaid, ask Paymob about it
//   node scripts/paymob-inquiry-check.js REF     ask about an existing reference (after paying or failing a test checkout)
//
// Needs the usual PAYMOB_* values in .env, plus PAYMOB_API_KEY (the API key from the Paymob dashboard).
import 'dotenv/config';
import { createCheckout } from '../src/paymob.js';

const HOST = 'https://accept.paymob.com';

async function paymob(path, { token, body } = {}) {
  const res = await fetch(HOST + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON: the raw text is printed below */ }
  return { status: res.status, json, text };
}

function show(label, r) {
  const t = r.json?.obj ?? r.json ?? {};
  const fields = { id: t.id, success: t.success, pending: t.pending, amount_cents: t.amount_cents, merchant_order_id: t.order?.merchant_order_id };
  console.log(`${label}\n  HTTP ${r.status}\n  fields: ${JSON.stringify(fields)}\n  body:   ${r.text.slice(0, 300) || '(empty)'}\n`);
}

export async function run(refArg) {
  if (!process.env.PAYMOB_API_KEY) throw new Error('Add PAYMOB_API_KEY (from the Paymob dashboard) to .env first');
  const auth = await paymob('/api/auth/tokens', { body: { api_key: process.env.PAYMOB_API_KEY } });
  const token = auth.json?.token;
  console.log(`auth token: HTTP ${auth.status}${token ? ' (got a token)' : ` (no token) ${auth.text.slice(0, 200)}`}\n`);
  if (!token) return;
  const inquire = (ref) => paymob('/api/ecommerce/orders/transaction_inquiry', { token, body: { merchant_order_id: ref } });

  if (refArg) return show(`reference ${refArg}`, await inquire(refArg));

  const attempt = Date.now(); // unique, so Paymob never sees a repeated reference
  const order = {
    id: '0'.repeat(24), total: 10000, shippingFee: 0, publicToken: 'diagnostic', email: 'check@example.com',
    customer: { name: 'Check Script', phone: '+201000000000' }, items: [{ qty: 1, name: 'Diagnostic item', price: 10000 }],
  };
  const url = await createCheckout(order, attempt);
  const ref = `${order.id}-${attempt}`;
  console.log(`created a test payment, reference ${ref}\ncheckout (leave it unopened for the unpaid test): ${url}\n`);
  show('1. a reference that was never created', await inquire(`never-created-${attempt}`));
  show('2. created, left unpaid', await inquire(ref));
  console.log(`Next: open the checkout and pay with a Paymob TEST card, then run\n  node scripts/paymob-inquiry-check.js ${ref}\nRepeat with a declined test card to see a failed attempt.`);
}

if (process.argv[1]?.endsWith('paymob-inquiry-check.js')) {
  await run(process.argv[2]).catch((e) => { console.error(e.message); process.exit(1); });
}
