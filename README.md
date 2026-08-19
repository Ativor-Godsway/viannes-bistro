# Viannes Bistro 🥪🥤🍟

Full-stack ordering platform for **Viannes Bistro**, an all-day bistro serving
sandwiches, hot plates, sides and smoothies to the University of Ghana, Legon
campus.

- **Client** — React 18 + TypeScript + Vite, Tailwind CSS, Framer Motion, Zustand, Socket.io.
- **Server** — Node/Express, MongoDB (Mongoose), Socket.io real-time, JWT auth, Paystack payments.

Customer ordering flow (menu → configurator → cart → checkout → live tracking)
plus an admin panel (dashboard, live orders, menu CRUD).

## Prerequisites
- Node.js 18+
- MongoDB running locally at `mongodb://127.0.0.1:27017` (or set `MONGO_URI`)

## Setup
```bash
npm run install:all          # install root + server + client deps
cp server/.env.example server/.env
npm run seed                 # create the admin account + sync the catalogue
npm run dev                  # server on :5000, client on :5173
```

## Accounts
| Role  | Email                        | Password                                   |
|-------|------------------------------|--------------------------------------------|
| Admin | set via `SEED_ADMIN_EMAIL`   | set via `SEED_ADMIN_PASSWORD` (no default) |

## URLs
- Customer site: http://localhost:5173
- Admin panel:   http://localhost:5173/admin
- API:           http://localhost:5000/api

## Payments

Payments run through **Paystack**, live — there is no stub. (An earlier build
shipped `server/src/services/payment.stub.ts`; that file is gone and this README
used to describe it long after the fact.)

- `server/src/services/paystack.ts` — transaction initialisation, verification
  and webhook signature checking. Amounts are converted to **pesewas** there and
  nowhere else.
- `server/src/controllers/payment.ts` — the verify and webhook endpoints.
- **Cash on delivery** never touches the gateway. Card and mobile money open a
  Paystack transaction and redirect the customer to
  `<PUBLIC_APP_URL>/payment/callback`.
- The charged total is always **server-computed** (`server/src/utils/pricing.ts`
  plus `server/src/config/fees.ts`). A total posted by the client is ignored.
- `PAYSTACK_MODE` defaults to `test`. Live mode requires a matching `sk_live_`
  key and refuses to start with a test key — see `server/src/config/env.ts`.

## Menu content

The catalogue is a hardcoded file: `server/src/data/catalogue.ts`. It is upserted
into MongoDB on boot (`SYNC_CATALOGUE_ON_BOOT`) and mirrored to the client's
offline fallback by `npm --prefix client run catalogue`.

> ⚠️ **Every price in the catalogue is still a placeholder** carried over from the
> previous build. Replace them before taking real money — the file's own banner
> says the same thing.

## Deferred
Inventory, staff/payroll, financials, full analytics, promotions engine, customer
management, restaurant settings, support/reviews, exports, Docker/CI. SEO
(meta description, Open Graph, JSON-LD, robots.txt, sitemap, manifest) is
currently absent entirely.
