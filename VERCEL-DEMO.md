# Read-only Vercel demo

This setup deploys the storefront and Express API as **two separate Vercel Hobby projects**. It is a noncommercial catalog demo: customers can browse and search products, while sign-in, favorites, cart, orders, checkout, payments, and admin actions remain disabled. The API rejects every non-read request on Vercel even if `DEMO_READ_ONLY` is accidentally omitted.

This is separate from the existing Render API and the existing Vercel storefront deployment. Do not point the demo at the production MongoDB database or enter production payment, mail, OAuth, or admin secrets in these projects.

Vercel Hobby is restricted to personal, noncommercial use. Its Cron Jobs can run only once per day and have up to 59 minutes of timing variation, so this demo has no periodic order or account jobs. See [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby) and [Cron Job limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 1. Create an isolated demo database

1. Create a separate MongoDB database named exactly `stringtopia_demo` and a database user scoped to that database. Never reuse the production database URI.
2. Create a temporary database user with read/write access for the catalog import. After importing, use a separate read-only database user for the API project.
3. In the `server` directory, copy `.env.demo.example` to `.env.demo` and fill in the demo database URI and the public catalog endpoint. This local file is ignored by Git.
4. Wait for the existing storefront project to deploy this GitHub update, then confirm its public `/api/backend/products` endpoint returns the catalog. The importer reads from that endpoint; it does not read the storefront's database directly.
5. Seed only the public product catalog and category names:

   ```powershell
   cd server
   node --env-file=.env.demo src/seedDemoCatalog.js
   ```

   The importer accepts HTTPS catalog URLs, copies product fields and image URLs, and writes only products and product-derived categories. It does not copy accounts, orders, payment details, promo codes, or admin data. It refuses to run unless the target database is named `stringtopia_demo`.
6. Create a read-only MongoDB user scoped to `stringtopia_demo`; use this user's URI as the API project's `MONGO_URI`. The API disables automatic index creation, so the importer creates the catalog indexes before seeding.

## 2. Deploy the API project

1. In Vercel, import `Tasneem849/Stringtopia-E-Commerce` as a new project. Set **Root Directory** to `server`.
2. Set these environment variables for Production and Preview:

   | Variable | Value |
   | --- | --- |
   | `MONGO_URI` | Read-only MongoDB URI for the isolated `stringtopia_demo` database |
   | `DEMO_READ_ONLY` | `true` |
   | `CLIENT_URL` | Exact origin of the storefront demo, with no trailing slash |

3. Deploy and verify `https://YOUR-API-PROJECT.vercel.app/api/health` returns `{"ok":true}`.

Vercel detects the Express app at `server/src/app.js`. The long-running local/Render listener is `server/src/localServer.js`; `npm start` and `npm run dev` still use it. On Vercel, the API reuses a Mongo connection per warm function instance and blocks all write methods.

## 3. Deploy the storefront project

1. Import the same GitHub repository as another Vercel project. Set **Root Directory** to `client`.
2. Set these environment variables for Production and Preview:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` |
   | `API_URL` | API project origin, such as `https://YOUR-API-PROJECT.vercel.app` |
   | `NEXT_PUBLIC_API_URL` | API origin plus `/api`, such as `https://YOUR-API-PROJECT.vercel.app/api` |
   | `NEXT_PUBLIC_SITE_URL` | Storefront demo origin |
   | `NEXT_PUBLIC_CURRENCY` | `EGP` |

3. Deploy. The demo banner is visible, account/commerce pages redirect to the catalog, and product pages show that ordering is unavailable. Set the storefront origin in the API project's `CLIENT_URL` if its generated domain changes.

The `NEXT_PUBLIC_` demo setting is embedded during the build. Redeploy after changing it. The regular production storefront leaves this flag unset and continues using its existing Render API configuration.

## 4. Verify the demo

- [ ] The storefront home page displays products and a read-only demo notice.
- [ ] Product browsing, category filters, and search work.
- [ ] `/cart`, `/checkout`, `/login`, `/account`, `/favorites`, `/orders`, and `/admin` return to the catalog.
- [ ] A direct `POST` to the demo API returns `403` with code `DEMO_READ_ONLY`.
- [ ] API and storefront use only the isolated demo database; no live payment or customer data is configured.

Use the existing [production deployment guide](DEPLOY.md) for the commercial storefront and Render API. Do not switch the shop's live project to the Hobby demo configuration.
