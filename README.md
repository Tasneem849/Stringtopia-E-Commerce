# Stringtopia

[![CI](https://github.com/Tasneem849/Stringtopia-E-Commerce/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Tasneem849/Stringtopia-E-Commerce/actions/workflows/ci.yml)

A full-stack storefront for handmade crochet, built for customers in Egypt. The shop supports EGP pricing, local delivery and pickup, and several payment methods.

**Live demo (read-only):** [Storefront](https://stringtopia-demo-storefront.vercel.app/) · [API health](https://stringtopia-demo-api.vercel.app/api/health)

**Production storefront:** [stringtopia-e-commerece-xcye.vercel.app](https://stringtopia-e-commerece-xcye.vercel.app/)

## Screenshots

| Home Page | Admin Login | Cart |
| --- | --- | --- |
| <img width="280" alt="Home Page" src="https://github.com/user-attachments/assets/9676bae7-2644-4c64-bccb-0ec6c0df07f5" /> | <img width="280" alt="Admin Login Form" src="https://github.com/user-attachments/assets/97e8f039-a14c-4d52-a19b-422572912e57" /> | <img width="280" alt="Shopping Cart Page" src="https://github.com/user-attachments/assets/aa94c556-9f18-433c-a7a1-8959aaf92b03" />

<details>
  <summary>More screenshots</summary>
  <img width="280" alt="Create Account Form" src="https://github.com/user-attachments/assets/e6108cd3-0fa5-49be-bca7-a5643ae4706a" />
  <img width="280" alt="Loading Animation" src="https://github.com/user-attachments/assets/a746fd35-a29c-4b3e-b977-6a2252adfcf2" />
  <img width="280" alt="Variant" src="https://github.com/user-attachments/assets/ee3dbfce-3b6f-4aec-838a-295b4b4eeb90" />
</details>

## Features

- Product catalog with search, category and price filters, sorting, pagination, sale prices, selectable variants, and image galleries.
- Guest checkout and customer accounts with Google or email/password sign-in, favorites, and self-service account deletion with a seven-day cancellation period.
- Admin sign-in with authenticator-app two-factor, rate limiting, and an audit log.
- Cash on delivery, InstaPay, and Paymob checkout, subject to the shop's active provider configuration.
- Order reservations for made-to-order items, customer order tracking, and cancellation options.
- Admin tools for products, categories, stock, promo codes, orders, manually entered phone or WhatsApp orders, expenses, and profit reporting.
- Cloudinary product and audio uploads, customer email notifications, and optional background store audio.

## Technology

| Area | Stack |
| --- | --- |
| Storefront | Next.js App Router, React, Tailwind CSS |
| API | Node.js, Express, Mongoose |
| Data | MongoDB Atlas |
| Payments | Paymob, InstaPay, cash on delivery |
| Media and email | Cloudinary, SMTP |
| Hosting | Vercel storefront, Render API |

## Repository layout

```text
client/                 Next.js storefront and admin interface
server/                 Express API, MongoDB models, and API tests
.github/workflows/      Continuous integration
ASSET-RIGHTS.md         Project and creative-asset use notice
DEPLOY.md               Deployment and production configuration
VERCEL-DEMO.md          Separate read-only Vercel Hobby catalog demo
```

## Run locally

You need Node.js 22 (20 or later for the API) and a MongoDB database for development. Use a separate development database; never point local setup or tests at live customer data.

### 1. Configure and start the API

In a terminal:

```bash
cd server
npm ci
```

Copy `server/.env.example` to `server/.env` (PowerShell: `Copy-Item .env.example .env`) and set at least `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=http://localhost:3000`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Use a strong local JWT secret and a development-only database.

To add the sample catalog to that development database, run `npm run seed` once. Then start the API:

```bash
npm run dev
```

### 2. Configure and start the storefront

In a second terminal:

```bash
cd client
npm ci
```

Copy `client/.env.local.example` to `client/.env.local` (PowerShell: `Copy-Item .env.local.example .env.local`). Its default API URL is for local development. For Google sign-in, configure a Google OAuth Web client and put the same client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the client file and `GOOGLE_CLIENT_ID` in `server/.env`. Add `http://localhost` and `http://localhost:3000` as authorized JavaScript origins.

Start the storefront:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:5000/api/health](http://localhost:5000/api/health).

### Environment files and secrets

The checked-in `.env.example` files contain placeholders only. Keep `.env`, `.env.local`, API keys, database credentials, payment secrets, and OAuth client secrets out of Git. Only browser-safe values should use the `NEXT_PUBLIC_` prefix; the Google OAuth client ID is public, while `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and payment credentials belong on the server.

## CI and tests

GitHub Actions runs the API test suite against a disposable MongoDB service and builds the storefront on pushes to `main` and pull requests. API integration tests require `TEST_MONGO_URI`, create a fresh uniquely named database for their run, and drop only that database afterward; they never fall back to the application's `MONGO_URI`. Never point `TEST_MONGO_URI` at production or shared data. See [server/README.md](server/README.md) for API details.

## Deployment

See [DEPLOY.md](DEPLOY.md) for the Vercel, Render, MongoDB Atlas, Google OAuth, Paymob, Cloudinary, and email setup. Provider plans and billing rules can change; review the current plan and usage terms before deploying a live shop.

For a separate, read-only noncommercial catalog preview on Vercel Hobby, see [VERCEL-DEMO.md](VERCEL-DEMO.md). It uses a dedicated demo database and never enables checkout or customer accounts.

## License and asset rights

The source code is available under the [PolyForm Noncommercial License 1.0.0](LICENSE).
You may use, study, and modify it for noncommercial purposes. Commercial use requires separate written permission; contact: tasneemmohamed2013@gmail.com.

Stringtopia's name, logo, illustrations, product descriptions, and original creative assets are not covered by this license; see [ASSET-RIGHTS.md](ASSET-RIGHTS.md). Third-party materials retain their own rights.
