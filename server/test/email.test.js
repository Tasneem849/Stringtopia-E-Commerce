import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mail } from '../src/email.js';

Object.assign(process.env, { CLIENT_URL: 'http://localhost:3000', PICKUP_ADDRESS: '1 Test Street', NOTIFY_EMAIL: 'seller@example.com', CURRENCY: 'EGP' });
delete process.env.SMTP_HOST; // without SMTP, emails are printed instead of sent

// Capture what would have been sent
function capture(send) {
  const lines = [];
  const original = console.log;
  console.log = (text) => lines.push(String(text));
  try { send(); } finally { console.log = original; }
  return lines.join('\n');
}
const order = {
  email: 'mona@example.com', user: 'u1', publicToken: 'tok123', total: 25000, eta: '2 weeks',
  expiresAt: new Date('2026-10-13T12:00:00Z'), declineReason: 'Too busy',
  items: [{ qty: 2, name: 'Daisy <b>plush</b>' }],
  delivery: { method: 'delivery', gift: true, recipientName: 'Mona <script>', address: { line1: '1 Nile St', city: 'Cairo', country: 'Egypt' } },
};

test('approval email links to the on-demand pay page and shows the estimate and total', () => {
  const out = capture(() => mail.approved(order));
  assert.match(out, /To: mona@example.com/);
  assert.match(out, /http:\/\/localhost:3000\/pay\/tok123/);
  assert.match(out, /2 weeks/);
  assert.match(out, /250\.00/);
});

test('customer-provided text is escaped before it goes into the email', () => {
  // Tags are stripped from the console copy, so seeing the entities proves the text was escaped
  const out = capture(() => mail.approved(order));
  assert.match(out, /&#60;script&#62;/);
  assert.match(out, /Daisy &#60;b&#62;plush/);
});

test('a paid order emails both the customer and the seller', () => {
  const out = capture(() => mail.paid(order));
  assert.match(out, /To: mona@example.com/);
  assert.match(out, /To: seller@example.com/);
});

test('a pickup order is announced as ready for pickup with the address', () => {
  const out = capture(() => mail.shipped({ ...order, delivery: { method: 'pickup' } }));
  assert.match(out, /Subject: Your order is ready for pickup/);
  assert.match(out, /1 Test Street/);
});

test('guests get a link to their order page instead of the account page', () => {
  const out = capture(() => mail.paid({ ...order, user: undefined }));
  assert.match(out, /thanks\?ref=tok123/);
});
