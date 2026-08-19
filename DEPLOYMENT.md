# Deploying Viannes Bistro

Client on **Vercel**, API on **Render**, database on **MongoDB Atlas**, images on
**Cloudinary**, payments through **Paystack**.

Deploy in this order — the client's build needs the API's URL, and Paystack's
webhook needs the API's URL:

1. Atlas (database) → 2. Cloudinary → 3. Render (API) → 4. Vercel (client)
→ 5. point Render's `CLIENT_ORIGINS` and `PUBLIC_APP_URL` at the Vercel URL
→ 6. Paystack webhook.

---

## 1. Environment variables

### Server — Render

| Variable | Secret | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `production` | Render sets this automatically. |
| `PORT` | no | *(leave unset)* | Render injects it. |
| `TRUST_PROXY` | no | `1` | **Required.** Render terminates TLS at one proxy. Without it the rate limiter buckets every visitor into one IP and `Secure` cookies aren't recognised. |
| `MONGO_URI` | **yes** | `mongodb+srv://user:pass@cluster.mongodb.net/viannes` | No fallback — a missing value stops the boot. Use a **separate production database**. |
| `JWT_SECRET` | **yes** | *(48 random bytes)* | Minimum 32 chars, no default. `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | no | `7d` | Also sets the session cookie's lifetime. |
| `CLIENT_ORIGINS` | no | `https://viannes.vercel.app` | Comma-separated, absolute, **no trailing slash**. Drives CORS and Socket.IO. A *set* — order is not meaningful. |
| `PUBLIC_APP_URL` | no | `https://viannes.vercel.app` | **Required.** Where the browser app is served from; builds the Paystack redirect `<PUBLIC_APP_URL>/payment/callback`. **Set this wrong and paying customers are redirected to the wrong site after paying.** Must be `https` and non-localhost in production. Warns at boot if it isn't also in `CLIENT_ORIGINS`. |
| `CLIENT_ORIGIN_REGEX` | no | `^https://viannes-[a-z0-9-]+\.vercel\.app$` | Lets Vercel **preview** deploys through — without it every preview URL is CORS-blocked. **Anchor both ends** (see below). |
| `SYNC_CATALOGUE_ON_BOOT` | no | `true` | **Safe to leave on.** Upsert only — it never deletes. Items dropped from `catalogue.ts` are hidden, not destroyed. |
| `DELIVERY_FEE_GHS` | no | `5` | Server-authoritative. Any `deliveryFee` in a request body is ignored. |
| `PAYSTACK_MODE` | no | `live` | Live is opt-in. A live key with `test` (or vice versa) is rejected at boot. |
| `PAYSTACK_SECRET_KEY` | **yes** | `sk_live_…` | Required in production. **Never** goes near the client. |
| `PAYSTACK_WEBHOOK_SECRET` | **yes** | *(usually blank)* | Only if you rotate it separately; defaults to the secret key, which is what Paystack signs with. |
| `CLOUDINARY_CLOUD_NAME` | no | `viannes` | All three or none. |
| `CLOUDINARY_API_KEY` | **yes** | `123456789012345` | |
| `CLOUDINARY_API_SECRET` | **yes** | `abc…` | |
| `SEED_ADMIN_EMAIL` | no | `admin@yourdomain.com` | Only for the destructive `npm run seed`. |
| `SEED_ADMIN_PASSWORD` | **yes** | *(24 random bytes)* | No default; minimum 12 chars. |

### Client — Vercel

Everything below is **compiled into public JavaScript**. Never put a secret here.

| Variable | Secret | Example | Notes |
|---|---|---|---|
| `VITE_API_URL` | no | `https://viannes-api.onrender.com/api` | **Include the `/api` suffix.** |
| `VITE_SOCKET_URL` | no | `https://viannes-api.onrender.com` | Origin only, **no path**. |

Leave both unset locally — they fall back to relative paths that the Vite dev
proxy forwards, so local development is unchanged.

---

## 2. MongoDB Atlas

1. Create a **separate production cluster/database** — do not reuse the dev one
   currently in `server/.env`.
2. Database Access → add a user with a long generated password, role
   `readWrite` on that database only.
3. Network Access → allowlist Render's egress IPs. Render publishes them per
   region under the service's *Connect* → *Outbound* panel. If you cannot pin
   them, `0.0.0.0/0` is acceptable **only** with a strong generated password —
   the connection string is then the sole credential.
4. Copy the `mongodb+srv://…` string into Render's `MONGO_URI`.

## 3. Cloudinary

1. Sign up, then Console → **Dashboard** → *API Keys*.
2. Copy *Cloud name*, *API Key*, *API Secret* into the three Render variables.
3. Uploads land in the `viannes/menu` folder, capped at 1600×1600 and 5MB.

Without these the app runs normally; admin image upload returns
`503 Image uploads are not configured`.

## 4. Render (API)

The repo has `render.yaml`, so: **New → Blueprint** → pick this repo. Or enter
the settings manually:

| Setting | Value |
|---|---|
| Type | **Web Service** (not a serverless/edge target — Socket.IO needs a long-lived connection) |
| Root directory | `server` |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Region | `frankfurt` (closest to Ghana) |

`--include=dev` is **required, and verified**: Render sets `NODE_ENV=production`,
which makes `npm ci` skip devDependencies — and `typescript` is one, so a plain
`npm ci` fails with `sh: tsc: not found`.

Then set every `sync: false` variable from the table above in the dashboard.

### ⚠️ Free tier trade-off — read before choosing a plan

Free instances **sleep after ~15 minutes idle** and cold-start in 30–60s. What
that actually costs:

| Effect | Impact | Mitigated? |
|---|---|---|
| First request after sleep takes 30–60s | The first customer of the morning waits | Partly — axios allows 60s and the storefront shows "Warming up the kitchen…" instead of an error |
| Open websockets drop | Admin live updates stop | Yes — the socket re-handshakes automatically and every consumer refetches on reconnect |
| Events fired while the socket is down reach nobody | **An order placed during a cold start would never appear on the Orders page** | Yes — this was the real bug. Reconnect triggers a refetch, and the Orders page also polls every 60s while visible |
| Stale-session handshake rejection | Noisy `access control checks` error in Safari's console | Yes — a rejected session forces a fresh handshake instead of retrying a dead `sid` |

Socket.IO does **not** queue or replay events, so none of this is recoverable
by the socket layer alone; the refetch-on-reconnect is what makes it safe.

**The cheapest paid Render instance (Starter) removes all of it** — it does not
sleep. For a shop taking real orders that is the right call; the mitigations
above turn a silent data-loss bug into a latency annoyance, but they do not
make a sleeping API a good idea.

### Vercel preview deploys and `CLIENT_ORIGIN_REGEX`

Each Vercel preview gets its own hostname, so a fixed `CLIENT_ORIGINS` list
cannot cover them. Set on Render:

```
CLIENT_ORIGIN_REGEX=^https://viannes-[a-z0-9-]+\.vercel\.app$
```

**Anchor it at both ends.** `vercel.app` is a shared domain that anyone can
deploy to. Without the leading `^` and trailing `$`, the pattern would also
match `https://evil.vercel.app` (or `https://attacker.com/#viannes-x.vercel.app`),
handing a stranger's deployment an allowed path to this API. The anchors are
the whole security boundary here.

## 5. Vercel (client)

| Setting | Value |
|---|---|
| Root directory | **the repository root** (see below) |
| Framework preset | Vite |
| Build command | `npm --prefix client ci && npm --prefix client run build` |
| Output directory | `client/dist` |
| Install command | `npm ci` |

**Why root, not `client/`:** the build runs `prebuild` → `npm run catalogue`,
which generates the client's offline menu from `server/src/data/catalogue.ts`.
With Root Directory set to `client/`, Vercel excludes everything above it and
that file is missing.

If you prefer Root Directory `client/`, enable
**Settings → Build → "Include files outside of the Root Directory in the Build
Step"**, and set Build Command `npm run build`, Output `dist`.

Either way the generator **fails the build loudly** if it cannot find the
catalogue, rather than shipping a stale menu that disagrees with the database.

`client/vercel.json` already supplies the SPA rewrite (so `/checkout`,
`/order/:id` and `/admin/orders` survive a refresh), the security headers, and
one-year immutable caching on `/assets/*` and `/menu/*`.

### After the client is live

Go back to Render and set **both** `CLIENT_ORIGINS` and `PUBLIC_APP_URL` to the
Vercel production URL, then redeploy the API. They are normally the same value
but mean different things: the first is the CORS allowlist, the second is where
Paystack sends a paying customer back to. Until you do, the browser blocks every request: the allowlist
is explicit and there is no wildcard (with credentialed requests, browsers
reject `Access-Control-Allow-Origin: *` outright).

## 6. Paystack

Dashboard → **Settings → API Keys & Webhooks**.

1. **Test and live are entirely separate** — separate keys *and* separate
   webhook URLs. Configure both if you want a test path after go-live.
2. Set the webhook URL to:
   ```
   https://<your-render-service>.onrender.com/api/payments/paystack/webhook
   ```
3. Copy the **Secret Key** into Render's `PAYSTACK_SECRET_KEY`. It never goes
   to Vercel.
4. The **Public Key** is not needed: the server initialises the transaction and
   redirects, so the browser never talks to Paystack's API directly.
5. Set `PAYSTACK_MODE=live` only when you mean it. Boot fails if the mode and
   the key prefix disagree, in either direction.

Test card (test mode only): `4084 0840 8408 4081`, any future expiry, any CVV.

---

## 7. Post-deploy checks

```bash
API=https://viannes-api.onrender.com
APP=https://viannes.vercel.app

curl -s $API/api/health                                  # {"ok":true}
curl -s $API/api/menu | head -c 200                      # six products, priced
curl -sI $APP/checkout | head -1                          # 200, not 404 (SPA rewrite)
curl -sD- -o /dev/null -H "Origin: https://evil.test" $API/api/menu | grep -i access-control  # nothing
curl -sD- -o /dev/null -H "Origin: $APP" $API/api/menu | grep -i access-control               # your origin + credentials
```

Then, in a browser: sign in at `/admin/login`, confirm `document.cookie` shows
**only** `viannes_csrf` (the session cookie is httpOnly and must not appear),
and place one real low-value order to confirm the webhook fires.

## 8. First admin account

The destructive seed is not the way in on production. Either:

- run it once against the production URI, deliberately:
  ```bash
  cd server
  MONGO_URI="<prod uri>" SEED_ADMIN_EMAIL="you@domain.com" \
    SEED_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
    npm run seed -- --force
  ```
  It refuses non-local databases without `--force`, and refuses to run at all
  without a password of at least 12 characters. **It deletes all users,
  categories and menu items** — only acceptable on an empty database.

- or insert one admin document by hand and let the boot-time catalogue sync
  populate the menu, which is the non-destructive path.
