# Security audit — Besties

Audited before first deployment. Severities are as they applied to a public
deployment, not to a laptop.

---

## ⛔ Act on these before going live

### 1. The default admin password still works on the shared cluster

`admin@besties.com` / `Admin123!` authenticates against the Atlas database in
`server/.env` **right now**. That password was published in `README.md` and
pre-filled into the admin login form, so it must be treated as public.

```bash
# rotate it
cd server
MONGO_URI="<uri>" SEED_ADMIN_EMAIL="you@domain.com" \
  SEED_ADMIN_PASSWORD="$(openssl rand -base64 24)" npm run seed -- --force
```
⚠️ That seed **deletes all users, categories and menu items**. On a database you
care about, change the password directly instead.

### 2. A live Paystack secret key is sitting in `server/.env`

`PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` are both `..._live_` values in
the local file, with `PAYSTACK_MODE=test`. The new boot validation **refuses to
start** on that combination, which is how it was found.

The file is gitignored and was never committed. Still: **rotate both keys** in
the Paystack dashboard if that file has ever been shared, synced or backed up,
and use **test** keys locally. Live keys move real money.

### 3. Atlas credentials are in a file on disk

`server/.env` contains a working `mongodb+srv://` URI with an inline password
for a shared cluster. Not committed (verified). Rotate the password if the file
has ever left the machine, and use a **separate production database** —
`DEPLOYMENT.md` §2.

---

## Git history

The repository was initialised during this work. **No `.env` has ever been
committed** — verified with `git ls-files`, and by grepping the staged tree for
the Atlas username, the Atlas password, `mongodb+srv`, `sk_live_` and `sk_test_`.
The only tracked env files are `.env.example` templates containing no values.

Because history starts clean, there is no secret to purge — the rotations above
are precautionary, based on the files having existed in plaintext on a
workstation.

---

## ⚠️ Bearer tokens in localStorage — a deliberate, temporary downgrade

**Status:** active. **Reverse this as soon as a custom domain exists.**

### What changed

The admin session was an `httpOnly` cookie. It is now a JWT returned in the
login response body, kept in `localStorage`, and sent as
`Authorization: Bearer <token>`. The CSRF layer was removed with it, and CORS
no longer uses `credentials`.

### Why

The app is served from `besties-zeta.vercel.app` and the API from
`besties-wyqe.onrender.com`. Those are different **registrable domains**, so
the session cookie was a **third-party cookie**:

- Safari's Intelligent Tracking Prevention blocks third-party cookies
  unconditionally. `SameSite=None; Secure` does not change that — Safari
  ignores it.
- Chrome restricts them and is removing them.
- Both hosts are on the Public Suffix List, so no `Domain=` attribute can
  bridge them.

The symptom was admin login appearing to succeed and then every subsequent
request returning 401, with a reload logging the user out. That is not an auth
bug and no amount of cookie-attribute tuning fixes it. Only a shared parent
domain does.

### What this costs

**An XSS on the storefront can now read the admin token and reuse it.** The
`httpOnly` cookie made that impossible — script could ride an existing session
while the page was open, but could not exfiltrate a credential for later use
elsewhere. That protection is gone until this is reversed.

Removing CSRF is *not* part of the cost: CSRF exists because browsers attach
cookies to cross-site requests automatically. An `Authorization` header is
never sent automatically, so there is nothing for a third-party page to forge.
Keeping the double-submit token would have been complexity that protected
nothing.

### What mitigates it

- **Admin tokens expire in 12 hours** (`ADMIN_EXPIRES_IN` in `utils/jwt.ts`),
  down from 7 days. Customer tokens keep the longer window — they grant far
  less. A stolen admin token stops working the same day.
- **No raw-HTML sink exists in the client.** Audited: zero occurrences of
  `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval` or `new Function`. React escapes everything it
  renders, and no user-supplied string is rendered as HTML anywhere.
- The origin allowlist, rate limiting, helmet, input sanitisation and
  server-side authorisation are all unchanged.
- A 401 response clears the stored token and returns the admin to the login
  page, so an expired token cannot linger.

**Gap:** the storefront is served by Vercel with **no Content-Security-Policy**
(see "Known gaps" below). CSP is the primary defence against the XSS this
change exposes us to, and it is currently absent.

### How to reverse it — once a custom domain exists

Put the app and the API on subdomains of one registrable domain
(`example.com` and `api.example.com`), which makes every request between them
same-site, then:

1. Restore `utils/authCookie.ts` and `middleware/csrf.ts` (both deleted in this
   change; recover from git history).
2. `controllers/auth.ts` — set the cookie instead of returning `token` in the
   body; re-issue the CSRF token.
3. `middleware/auth.ts` — read the cookie first, Bearer as a fallback.
4. `index.ts` — re-add `cookie-parser` and mount `requireCsrf` after it.
5. `config/origins.ts` — `credentials: true`, re-add `X-CSRF-Token` to
   `allowedHeaders`.
6. `config/socket.ts` — read the token from the handshake cookie again.
7. Client — `withCredentials: true` on axios and the socket; drop the
   `localStorage` token and the request interceptor.
8. Set the cookie to **`SameSite=Lax`**, not `None`. Subdomains of one domain
   are same-site, so `Lax` is sufficient *and* stricter — `None` sends the
   cookie on every cross-site request. Keep it **host-only** (no `Domain=`
   attribute) so it is not exposed to every future subdomain.
9. Restore the admin token expiry to whatever suits, since theft is no longer
   the same risk.

Also note: the client currently reads its CSRF token from `document.cookie`,
which only works when the app and the API share a host. On subdomains a
host-only cookie set by `api.` is **not** readable from the apex, so step 2
must also return the CSRF token in the login response body for the client to
store — otherwise every state-changing request will 403.

## Findings and fixes

### Critical

| # | Finding | Fix |
|---|---|---|
| 1 | **Not a git repository** — nothing could deploy. | `git init`; `.gitignore` extended to cover `server/.env`, `client/.env`, `.env.*` and the generated catalogue. Verified no secret is staged. |
| 2 | **`utils/seed.ts` deleted every User, Category and MenuItem** and created an admin with hardcoded `Admin123!` plus a demo customer. | Refuses non-local `MONGO_URI` without `--force`; `SEED_ADMIN_PASSWORD` required, no default, min 12 chars; demo customer only outside production; connection string redacted in output. |
| 3 | **JWT in `localStorage`** — any XSS exfiltrates an admin session. | Moved to an `httpOnly` `Secure` `SameSite=None` cookie (`utils/authCookie.ts`). CORS is now an explicit allowlist with `credentials: true`; axios uses `withCredentials`; `cookie-parser` added; double-submit CSRF on state-changing routes (`middleware/csrf.ts`); the Socket.IO handshake authenticates from the same cookie. The token no longer appears in any response body. `localStorage` keeps only a cached name/role for painting the shell, never trusted for authorisation. |
| 4 | **Paystack secret reaching the client bundle.** | **Was already clean** — no Paystack secret and no `VITE_*SECRET` anywhere in the client. Verified again against the built bundle (below). Added `src/vite-env.d.ts` documenting that everything `VITE_`-prefixed is public. |
| 5 | **No rate limiting.** | `express-rate-limit`: 5 login attempts / 15 min keyed on **IP + submitted email** (so one attacker cannot lock every account from a shared campus NAT), 10 orders / 10 min, 200 admin writes / 5 min, 600 requests / 15 min globally. `app.set('trust proxy', TRUST_PROXY)` set from env — without it Render's proxy makes every visitor share one bucket. |

### High

| # | Finding | Fix |
|---|---|---|
| 6 | **No `helmet`.** | Added, with a CSP appropriate to a JSON API: `script-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, images limited to self/data/Cloudinary, connect limited to self/Paystack. No `unsafe-inline` for scripts. The storefront's own CSP-adjacent headers are set in `client/vercel.json`. HSTS in production only. |
| 7 | **No query-operator injection defence.** | `express-mongo-sanitize` globally, **plus** explicit string coercion of every `req.query` value that reaches a Mongoose filter (`controllers/menu.ts`, `controllers/adminOrder.ts`). The admin order search also escapes its input before `new RegExp` and caps it at 64 chars — it was a ReDoS vector as well. Verified: `?category[$gt]=`, `[$ne]`, `[$regex]`, `[$where]` all return the unfiltered baseline. |
| 8 | **CORS was a single origin string**, and Socket.IO was configured separately. | `config/origins.ts` is one allowlist read by both: comma-separated `CLIENT_ORIGINS` plus optional `CLIENT_ORIGIN_REGEX` for Vercel previews. Blocked origins get no `Access-Control-Allow-Origin` header rather than a thrown 500. |
| 9 | **`MONGO_URI` silently fell back to localhost**; `JWT_SECRET` fell back to `'dev_secret_change_me'`. | `config/env.ts` validates everything with zod at boot and exits listing what is missing. `JWT_SECRET` has no default and requires 32+ chars. Cross-field rules too: Paystack mode vs key prefix, plaintext origins in production, partial Cloudinary config. |
| 10 | **Stack-trace leakage.** | Production 500s return `{"error":"Internal server error"}` and nothing else; details are logged server-side only. Added `CastError` → 400 (a malformed id was returning 500 plus a Mongoose message naming the model and path) and duplicate-key → 409 without echoing the value. |
| 11 | **`morgan('dev')` in production.** | `combined` when `NODE_ENV=production`. Neither format logs request bodies, so credentials, tokens and webhook payloads stay out of the log stream. |
| 12 | **`npm audit`.** | Server and root: **0 vulnerabilities** (production and dev). `multer` upgraded 1.4.5-lts.2 → **2.2.0**. Client: see *Accepted risk* below. |

### Medium

| # | Finding | Status |
|---|---|---|
| 13 | Webhook HMAC over the raw body. | **Already correct.** `paystackWebhookRouter` is mounted before `express.json()` with `express.raw()`; the ordering carries a comment warning against reordering, and the CSRF layer deliberately sits after it. Re-verified: bad signature → 401, valid → 200. |
| 14 | Paystack amount server-computed, in pesewas; `deliveryFee` ignored from the body. | **Already correct**, re-verified end to end: an order posting `deliveryFee: 0` for a delivery order was charged 5, and Paystack received `29200` for a GH₵292.00 total. |
| 15 | Webhook idempotency. | **Already correct**, re-verified: the same signed payload delivered three times logged `no-op (already settled)` and the order was fulfilled once. |
| 16 | Admin authorisation on every `/api/admin` route. | **Already correct** — `router.use(requireAuth, requireAdmin)` covers the whole router, and the role comes only from the verified JWT. Nothing anywhere reads a `role` from a request. Added an admin write limiter. |
| 17 | `compression`, body-size limits. | Added `compression()`; `express.json({ limit: '100kb' })` and the same on urlencoded. |
| 18 | Endpoints returning password hashes or full user documents. | **None found.** `publicUser()` is the only user shape returned and is explicitly constructed, so a field added to the schema later cannot leak by default. |

### Found beyond the brief

| Finding | Severity | Fix |
|---|---|---|
| **Any client could join the admin socket room.** `socket.on('admin:join')` had no authorisation, so an anonymous websocket received every new order — customer names, phone numbers and delivery addresses. | **Critical** | `admin:join` now requires an admin session read from the handshake cookie and acknowledges false otherwise. Verified: anonymous → `false`, admin → `true`. |
| **The admin login form shipped working credentials** — `admin@besties.com` / `Admin123!` pre-filled into the inputs and printed beneath them. | **Critical** | Fields start empty; the demo hint is gone; both are `required`. Also removed from `README.md`. |
| `order:subscribe` accepted any value as a room name. | Low | Validated against the `BST-XXXXXX` order-id format. |
| Uploads written to Render's ephemeral disk, and `tsc` never copied `uploads/` into `dist/`. | High | Moved to Cloudinary (below). |
| No logout endpoint — the client could not clear an httpOnly cookie. | Medium | `POST /api/auth/logout` clears it server-side; `GET /api/auth/me` lets the client rehydrate auth state without reading a token. |

---

## Uploads → Cloudinary

`middleware/upload.ts` wrote to `path.join(__dirname, '..', 'uploads')` with
multer disk storage. Two independent failures: Render's filesystem is ephemeral,
so every deploy deleted every admin-uploaded photo; and `tsc` does not copy that
directory into `dist/`, so the static mount pointed at nothing in a built app.

Now: multer **memory** storage → Cloudinary upload stream → only the permanent
`secure_url` is stored on the MenuItem, alongside a `publicId` so replacing a
photo deletes the old asset instead of accumulating orphans. The 5MB cap and
image-only filter are kept, narrowed to specific image mimetypes, and backed by
Cloudinary's `resource_type: 'image'` which inspects actual content rather than
the client-supplied type. The `/uploads` static mount and `server/src/uploads/`
are gone.

**Migration:** not needed. No MenuItem holds a `/uploads/...` path — the seeded
catalogue's photography is served statically from `client/public/menu/`, and the
`image.url` field is empty for all six products. If you had uploaded any photos
through the admin before now, they were already lost to the ephemeral disk.

---

## Verified

- Boot fails with a clear list when `MONGO_URI`, `JWT_SECRET` or
  `CLIENT_ORIGINS` is missing, and on a weak `JWT_SECRET`.
- Login returns **no token in the body**; sets `besties_session` (HttpOnly) and
  `besties_csrf` (readable). In a real browser `document.cookie` shows only the
  CSRF cookie, and `localStorage` holds no token.
- State-changing requests without a CSRF header → 403; wrong token → 403;
  correct token → 200. The webhook is exempt and still works.
- Tampered session token → 401. Missing session → 401. Logout → subsequent
  admin call 401.
- Rate limiting: the 6th failed login → 429; a different account is unaffected.
- CORS: disallowed origin gets no allow header; allowed origin gets its own
  origin plus `Access-Control-Allow-Credentials: true`.
- Injection: four operator payloads all return the unfiltered baseline.
- **Built bundle scanned** for `sk_live_`, `sk_test_`, `PAYSTACK_SECRET`,
  `JWT_SECRET`, `mongodb+srv`, the Atlas username and password, and the real
  values of `PAYSTACK_SECRET_KEY` / `JWT_SECRET` / `MONGO_URI` — **all absent**.
- The built client, served from a different origin, reaches the API
  cross-origin, authenticates by cookie, and loads admin data.
- SPA deep links (`/checkout`, `/admin/orders`, `/order/:id`, `/track/:id`) all
  serve `index.html`; hashed assets are not rewritten.
- Full Paystack purchase after all changes: correct pesewa amount, server fee
  override, signature enforcement, idempotent replay.

---

## Known gaps

- **No Content-Security-Policy on the storefront.** `client/vercel.json` sets
  `X-Content-Type-Options`, `X-Frame-Options`, HSTS, `Referrer-Policy` and
  `Permissions-Policy`, but no CSP. The strict CSP in `server/src/index.ts`
  applies only to API responses, which are JSON and execute nothing — it does
  not protect the pages users actually load. This matters more now that the
  admin token is script-readable (see above). The build emits no inline
  scripts, so a strict policy is achievable without `unsafe-inline`; a
  suggested header is in the handover notes.

## Accepted risk

- **`react-router-dom` 6.30.4** carries two moderate advisories (open redirect
  via backslash in `<Link>`; arbitrary constructor injection in
  `deserializeErrors` during **SSR hydration**). The fix is React Router 7, a
  breaking major. This app is a client-rendered SPA with **no SSR**, so the
  hydration path does not exist here, and no `<Link>` target is
  user-controlled — every route is a literal. Revisit when upgrading to v7.
- **Client dev-only advisories** (`esbuild`, `nanoid`, `postcss`) affect the
  Vite dev server and build tooling, not the deployed static output.
- **In-memory rate-limit store.** Fine for one Render instance; counters reset
  on deploy or cold start. Move to a Redis store if you scale past one instance.
- **Guest checkout is unauthenticated by design** — that is the product. It is
  protected by rate limiting and server-side pricing, not by identity.
- **No account lockout or 2FA** on admin login. Rate limiting only.
- **Free-tier cold starts** drop websockets; see `DEPLOYMENT.md`.
