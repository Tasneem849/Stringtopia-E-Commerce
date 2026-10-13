# Stringtopia storefront

Next.js (App Router) + Tailwind v4. Catalog and product pages are server-rendered for SEO.

1. `npm install`
2. `cp .env.local.example .env.local`
3. Start the API (`../server`, port 5000), then `npm run dev` and open http://localhost:3000

## Admin
Run `npm run seed` in the server, log in with ADMIN_EMAIL / ADMIN_PASSWORD, then open /admin
(requests inbox, orders, products). The API enforces admin-only access; the page guard is just for UX.
