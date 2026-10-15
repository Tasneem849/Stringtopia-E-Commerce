# Stringtopia storefront

Next.js (App Router) + Tailwind v4. Catalog and product pages are server-rendered for SEO.

1. `npm ci`
2. `cp .env.local.example .env.local`
3. Start the API (`../server`, port 5000), then `npm run dev` and open http://localhost:3000

## Admin
Run `npm run seed` in the server, log in with ADMIN_EMAIL / ADMIN_PASSWORD, then open /admin
(requests inbox, orders, products). The API enforces admin-only access; the page guard is just for UX.

## Google sign-in
Create a Web application OAuth client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Add `http://localhost` and `http://localhost:3000` as authorized JavaScript origins, then put the same client ID in `client/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `server/.env` as `GOOGLE_CLIENT_ID`. Restart both dev servers after changing the environment files.
