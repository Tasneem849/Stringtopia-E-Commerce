import crypto from 'node:crypto';

// Paymob Accept (Egypt): Intention API + Unified Checkout. Amounts are in piasters (1 EGP = 100).
const fail = (status, message) => Object.assign(new Error(message), { status });

// The fields Paymob signs in a transaction callback, in the order it concatenates them
const HMAC_FIELDS = ['amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success'];
const pick = (o, path) => path.split('.').reduce((v, k) => v?.[k], o);

// True only if the callback really came from Paymob (signed with your HMAC secret)
export function isValidHmac(obj, received) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret || !obj || !received) return false;
  const text = HMAC_FIELDS.map((f) => String(pick(obj, f) ?? '')).join('');
  const expected = Buffer.from(crypto.createHmac('sha512', secret).update(text).digest('hex'));
  const got = Buffer.from(String(received));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

let inquiryToken = '';
let inquiryTokenExpiresAt = 0;

async function getInquiryToken(apiKey) {
  if (inquiryToken && inquiryTokenExpiresAt > Date.now()) return inquiryToken;
  const response = await fetch('https://accept.paymob.com/api/auth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  const token = data.token || data.body?.token;
  if (!response.ok || !token) throw new Error('Paymob inquiry authentication failed');
  inquiryToken = token;
  inquiryTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return inquiryToken;
}

// Official Accept transaction inquiry by merchant reference. Uses the merchant API key,
// separate from the intention secret key (`PAYMOB_SECRET_KEY`).
export async function inquireTransactionByReference(reference) {
  const apiKey = process.env.PAYMOB_API_KEY;
  if (!apiKey || !reference) return null;
  const authToken = await getInquiryToken(apiKey);
  const response = await fetch('https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_token: authToken, merchant_order_id: reference }),
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Number.isFinite(Number(data.amount_cents)) || data.id == null) {
    throw new Error(`Paymob transaction inquiry failed with status ${response.status}`);
  }
  return data;
}

// Creates a payment and returns the Paymob checkout address to send the customer to.
export async function createCheckout(order, attempt) {
  const { PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_IDS, CLIENT_URL } = process.env;
  const API_URL = process.env.API_URL || process.env.RENDER_EXTERNAL_URL; // Render fills in the second one
  const methods = (PAYMOB_INTEGRATION_IDS || '').split(',').map((s) => +s.trim()).filter(Boolean);
  if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !methods.length) throw fail(503, 'Online payment is not set up yet');

  const [first, ...rest] = (order.customer?.name || 'Customer').trim().split(/\s+/);
  const res = await fetch('https://accept.paymob.com/v1/intention/', {
    method: 'POST',
    headers: { Authorization: `Token ${PAYMOB_SECRET_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      amount: order.total,
      currency: (process.env.CURRENCY || 'EGP').toUpperCase(),
      payment_methods: methods, // cards, mobile wallets... whatever integrations you listed
      // one line per product with quantity 1, so the lines always add up exactly to the amount
      items: [
        ...order.items.map((i) => ({ name: `${i.qty} x ${i.name}`.slice(0, 50), amount: i.price * i.qty, description: i.name.slice(0, 100), quantity: 1 })),
        ...(order.shippingFee ? [{ name: 'Delivery', amount: order.shippingFee, description: 'Delivery', quantity: 1 }] : []),
      ],
      billing_data: {
        first_name: first, last_name: rest.join(' ') || 'NA', email: order.email, phone_number: order.customer?.phone,
        country: 'EG', city: 'NA', state: 'NA', street: 'NA', building: 'NA', floor: 'NA', apartment: 'NA',
      },
      special_reference: `${order.id}-${attempt}`, // comes back as merchant_order_id in the callback; unique per attempt
      notification_url: `${API_URL}/api/orders/webhook`,
      redirection_url: `${CLIENT_URL}/thanks?ref=${order.publicToken}`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_secret) {
    console.error('Paymob error', res.status, JSON.stringify(data));
    throw fail(502, 'We could not start the payment. Please try again in a moment.');
  }
  return {
    url: `https://accept.paymob.com/unifiedcheckout/?publicKey=${PAYMOB_PUBLIC_KEY}&clientSecret=${data.client_secret}`,
    paymobOrderId: data.intention_order_id || data.order?.id || '',
  };
}
