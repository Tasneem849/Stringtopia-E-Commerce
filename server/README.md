# Stringtopia API

Express + MongoDB backend for a handmade-crochet store. Auth (JWT, customer/admin roles, email/password and Google sign-in), product catalog with search/filter/pagination, Paymob checkout (cards and mobile wallets, EGP) with callback-confirmed orders, and atomic stock updates.

## Run
1. `npm install`
2. `cp .env.example .env` and fill in values (MongoDB Atlas URI, Paymob test keys)
3. `npm run seed` (creates admin + sample products), then `npm run dev`
4. Payments locally: Paymob must reach your API, so expose it with a tunnel (e.g. `ngrok http 5000`) and set `API_URL` to that https address

## Endpoints
- `POST /api/auth/register | login | google`, `GET /api/auth/me`
- `GET /api/products` (`q, category, min, max, sort, page, limit`), `GET /api/products/:slug`
- `POST/PUT/DELETE /api/products` (admin)
- `POST /api/orders/checkout` (guests welcome), `GET /api/orders/by-ref/:token`, `POST /api/orders/pay/:token`, `GET /api/orders/mine`
- `GET /api/orders?status=requested`, `PATCH /api/orders/:id/ship` (admin)

## Roadmap
Next.js storefront, admin dashboard, Cloudinary uploads, reviews, order emails, tests, deploy.

## Reservation flow (only when stock can't cover the quantity)
If stock covers the quantity, use `POST /api/orders/checkout` (holds stock up to an hour while the customer pays).
If it doesn't (sold out, or they want 2 and only 1 is left), use `POST /api/orders/reserve` (items + optional note);
the API rejects the request if stock can cover any line.
Admin then calls `POST /api/orders/:id/approve` (optional `eta`; the customer then has 23 hours to pay through the "Pay now" link in their email)
or `POST /api/orders/:id/decline` (optional `reason`). Customers can `POST /api/orders/:id/cancel`.
Unanswered requests expire after `REQUEST_TTL_DAYS`. Reservations never touch stock: the item is made to order.

## Delivery
Every order has a `delivery` choice: `pickup` (free, collected at `PICKUP_ADDRESS`) or `delivery`
(`DELIVERY_FEE` cents, to the customer or, with `gift: true`, to someone else with an optional gift message).
The fee is added server-side as its own line in the Paymob payment. For pickup orders, "ship" in the admin API means "ready for pickup".

## Emails
Customers get: reservation received, approved (with the payment link), declined, expired, order confirmed, and
shipped / ready for pickup. The seller (`NOTIFY_EMAIL`) gets new reservation requests and new paid orders.
Configure SMTP in `.env`; without it the emails are printed to the server console. Email failures never block an order.

## Photo uploads
`GET /api/uploads/sign` (admin) returns a signed Cloudinary upload request. The admin page uploads straight to
Cloudinary, so photos never pass through this server. Set the three `CLOUDINARY_` values in `.env`.

## Tests
`npm test` runs the unit tests (payment requests, signature checks, prices, phone numbers, emails, rate limiting).
Set `MONGO_URI` to a database whose name contains `test` (for example `mongodb://127.0.0.1:27017/stringtopia_test`)
to also run the API tests: accounts, admin protection, catalog, checkout totals, the last-item race, reservations,
payment callbacks (forged, duplicated and late), and expiry. They wipe that database, so never point them at real data.
