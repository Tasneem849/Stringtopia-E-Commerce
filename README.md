# Stringtopia

A full-stack online shop for handmade crochet, built for the Egyptian market (EGP, Paymob, pickup or delivery).

## What it does
- Catalog with search, category filters, sorting and pagination; product pages with photo galleries (server-rendered for SEO)
- Guest checkout for in-stock items; accounts are optional, with email/password or Google sign-in
- **Reservations:** when stock can't cover an order, customers request it; the seller approves or declines, then the customer pays
- Delivery to yourself, delivery as a gift (with a card message), or free pickup
- Paymob payments (cards and mobile wallets), email notifications, Cloudinary photo uploads
- Admin dashboard: reservation inbox, orders with delivery details, product management

## Stack
Next.js (App Router) and Tailwind on the front end. Node, Express and MongoDB (Mongoose) on the back end.
Deployed on Vercel, Render and MongoDB Atlas.

## Usage and asset rights
You may use the high-level project structure—such as the folder organization and the separation between the client and server—as a reference for your own project. This permission does not grant permission to copy or redistribute this repository's source code.

Stringtopia's name, logo, illustrations, product photography, and other original creative assets are protected and may not be copied, modified, published, or reused without written permission from the applicable rights holder. Third-party materials remain the property of their respective owners. Viewing or cloning this public repository does not grant rights to those assets. See [ASSET-RIGHTS.md](ASSET-RIGHTS.md).

## Engineering notes
- **No overselling:** stock is held with one atomic update (`stock >= qty` and the decrement in the same operation) and released if the order is cancelled or expires.
- **Payments are confirmed server-to-server:** Paymob's callback is verified with an HMAC, checked against the order total, and claimed with an atomic status change, so retries can't process an order twice. Payments that arrive after an order expired are still honoured.
- **Prices and fees are decided on the server**, never trusted from the browser.
- **Pay links never go stale:** emails link to the site, which creates a fresh Paymob checkout on demand.
- Admin-only routes are enforced by the API; photo uploads go straight to Cloudinary using a signature only admins can request.
- **Tested:** unit tests plus API tests against a real MongoDB, including six buyers racing for the last item and Paymob callbacks that are forged, duplicated or late. They run on every push with GitHub Actions.

## Run locally
See `server/README.md` and `client/README.md`. To deploy, follow `DEPLOY.md`.
