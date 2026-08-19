# Besties Fast Food 🍕🍔🌮🍪

Full-stack fast food ordering platform for **Besties** (University of Ghana campus).

- **Client** — React 18 + TypeScript + Vite, Tailwind CSS, Framer Motion animations, Zustand, Socket.io.
- **Server** — Node/Express, MongoDB (Mongoose), Socket.io real-time, JWT auth, stubbed payments.

This is the **MVP (Phase 1)** build: animated homepage, customer ordering flow
(menu → cart → checkout → live tracking), and an admin panel (dashboard, live orders, menu CRUD).

## Prerequisites
- Node.js 18+
- MongoDB running locally at `mongodb://127.0.0.1:27017` (or set `MONGO_URI`)

## Setup
```bash
npm run install:all          # install root + server + client deps
cp server/.env.example server/.env
npm run seed                 # create demo data + accounts
npm run dev                  # server on :5000, client on :5173
```

## Demo accounts
| Role     | Email               | Password   |
| Admin    | set via `SEED_ADMIN_EMAIL` | set via `SEED_ADMIN_PASSWORD` (no default) |
|----------|---------------------|------------|

## URLs
- Customer site: http://localhost:5173
- Admin panel:   http://localhost:5173/admin
- API:           http://localhost:5000/api

## Payments
Payments are **stubbed** for this build — Cash on Delivery works fully; card / mobile money are
simulated (always succeed). Swap `server/src/services/payment.stub.ts` for real Paystack later.

## Deferred (Phase 2/3)
Inventory, staff/payroll, financials, full analytics, promotions engine, customer management,
restaurant settings, support/reviews, exports, real Paystack, Docker/CI.
# besties
# viannes-bistro
