# Stringtopia API

Express + MongoDB backend for a handmade-crochet store. Auth (JWT, customer/admin roles, email/password and Google sign-in), product catalog with search/filter/pagination, Paymob and InstaPay transfers, cash-on-delivery orders, and atomic stock updates.

## Run
1. `npm ci`
2. `cp .env.example .env` and fill in values (MongoDB Atlas URI, Paymob test keys, and InstaPay account/WhatsApp details if enabled)
3. `npm run seed` (creates admin + sample products), then `npm run dev`
4. Payments locally: Paymob must reach your API, so expose it with a tunnel (e.g. `ngrok http 5000`) and set `API_URL` to that https address. Configure `PAYMOB_API_KEY` too so the expiry sweep and thank-you page can verify delayed callbacks.

## Endpoints
- `POST /api/auth/register | login | google`, `GET /api/auth/me`
- `GET /api/favorites`, `POST /api/favorites/:productId`, `DELETE /api/favorites/:productId` (authenticated)
- `GET /api/products` (`q, category, min, max, sort, page, limit`), `GET /api/products/:slug`
- `GET /api/admin/products`, `POST/PUT/DELETE /api/admin/products` (admin only)
- `POST /api/orders/checkout` (guests welcome; accepts `paymentMethod: paymob | instapay | cod`), `GET /api/orders/by-ref/:token`, `POST /api/orders/by-ref/:token/reconcile`, `POST /api/orders/pay/:token`, `POST /api/orders/by-ref/:token/instapay-reference`, `GET /api/orders/mine`
- `GET /api/admin/orders?status=pending&page=1&limit=20`, `PATCH /api/admin/orders/:id/confirm-payment`, `PATCH /api/admin/orders/:id/complete-cod`, `PATCH /api/admin/orders/:id/out-for-delivery`, `PATCH /api/admin/orders/:id/cancel`, `PATCH /api/admin/orders/:id/ship` (admin only)

All `/api/admin/*` endpoints require a Bearer token for an account whose server-side role is `admin`. Registration and Google sign-in create customer accounts only.

## Roadmap
Next hardening work: email verification/recovery, a checkout CAPTCHA after its provider and data flow are approved, a shared rate limiter for multiple API instances, and broader Mongo-backed checkout/auth tests. Sentry and production monitoring need project credentials before they can be enabled.

## Reservation flow (only when stock can't cover the quantity)
If stock covers the quantity, use `POST /api/orders/checkout` (holds stock while the customer completes Paymob or InstaPay, or until a cash-on-delivery order is fulfilled).
If it doesn't (sold out, or they want 2 and only 1 is left), use `POST /api/orders/reserve` (items + optional note);
the API rejects the request if stock can cover any line.
Admin then calls `POST /api/admin/orders/:id/approve` (optional `eta`; the customer then has 23 hours to pay through the "Pay now" link in their email)
or `POST /api/admin/orders/:id/decline` (optional `reason`). Customers can `POST /api/orders/:id/cancel`.
Unanswered requests expire after `REQUEST_TTL_DAYS`. Reservations never touch stock: the item is made to order.

## Delivery
Every order has a `delivery` choice: `pickup` (free, collected at `PICKUP_ADDRESS`) or `delivery`
(`DELIVERY_FEE` piasters, to the customer or, with `gift: true`, to someone else with an optional gift message).
The fee is added server-side to the order total for every payment method. For pickup orders, "ship" in the admin API means "ready for pickup".

## Emails
Customers get: reservation received, approved (with the payment link), declined, expired, order confirmed, and
shipped / ready for pickup. The seller (`NOTIFY_EMAIL`) gets new reservation requests, new COD/InstaPay orders, submitted InstaPay references, and new paid orders.
Configure SMTP in `.env`; without it the emails are printed to the server console. Email failures never block an order.

## Photo uploads
`GET /api/admin/uploads/sign` (admin only) returns a signed Cloudinary upload request. The admin page uploads straight to
Cloudinary, so photos never pass through this server. Set the three `CLOUDINARY_` values in `.env`.

## Background audio
Admins can upload, replace, or remove the storewide looping track at `/admin/audio`. It uses the same Cloudinary credentials as product photos; audio files up to 20 MB are accepted. The public player attempts audible autoplay, falls back to muted playback if the browser blocks it, and gives guests and customers a mute/unmute control.

## Tests
`npm test` runs the unit tests (payment requests, signature checks, prices, phone numbers, emails, rate limiting).
Set `MONGO_URI` to a database whose name contains `test` (for example `mongodb://127.0.0.1:27017/stringtopia_test`)
to also run the API tests: accounts, admin protection, catalog, checkout totals, the last-item race, reservations,
payment callbacks (forged, duplicated and late), and expiry. They wipe that database, so never point them at real data.
