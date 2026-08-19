import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';

// Validated first: a missing or malformed variable exits here with a list of
// what is wrong, rather than booting and failing on the first real request.
import { env, isProduction } from './config/env';
import { corsOptions } from './config/origins';
import { connectDB } from './config/db';
import { syncCatalogue } from './utils/syncCatalogue';
import { initSocket } from './config/socket';
import { errorHandler, notFound } from './middleware/error';
import { globalLimiter } from './middleware/rateLimit';

import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/order';
import adminRoutes from './routes/admin';
import paymentRoutes, { paystackWebhookRouter } from './routes/payment';

async function main() {
  await connectDB(env.MONGO_URI);

  if (env.SYNC_CATALOGUE_ON_BOOT) {
    // Safe to leave on in production: syncCatalogue is an upsert that never
    // deletes — items dropped from the catalogue are hidden, not removed.
    // A failure here must not take the server down; the API is still perfectly
    // serviceable against whatever is already in the database.
    try {
      const report = await syncCatalogue();
      console.log(
        `🍽️  Catalogue synced: ${report.itemsUpserted} items, ` +
          `${report.categoriesUpserted} categories, ${report.templatesUpserted} templates.`
      );
      if (report.retired.length) {
        console.log(`   ↳ hidden (no longer in the catalogue): ${report.retired.join(', ')}`);
      }
    } catch (err) {
      console.error('⚠️  Catalogue sync failed; serving the database as-is.', err);
    }
  }

  const app = express();

  // Render terminates TLS at its edge, so without this every request appears to
  // come from one proxy address: rate limiting would key the whole internet to
  // a single bucket and `secure` cookies would not be recognised as secure.
  app.set('trust proxy', env.TRUST_PROXY);
  // Don't advertise the framework.
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          // The API serves JSON, not pages. Nothing here should ever execute a
          // script, so the strictest possible policy costs us nothing — the
          // storefront's own CSP is set by Vercel (see client/vercel.json).
          scriptSrc: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'", 'https://api.paystack.co'],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      // Cloudinary and Paystack are separate origins; the default 'same-origin'
      // policy would break the redirect back from the gateway.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Explicit allowlist, never a wildcard: with credentials:true a browser
  // rejects `Access-Control-Allow-Origin: *` and the session cookie is dropped.
  app.use(cors(corsOptions));
  app.use(compression());

  // BEFORE express.json(): the Paystack webhook's signature is an HMAC over the
  // RAW bytes, which a JSON parse would destroy. Do not reorder this. It is also
  // deliberately ahead of the CSRF check — it is a server-to-server call
  // carrying no cookie, authenticated by that signature instead.
  app.use('/api/payments', paystackWebhookRouter);

  // Bounded bodies. An order is a few hundred bytes; the default 100kb is
  // already generous and there is no endpoint that needs more.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Strips `$`-prefixed and dotted keys, so `?category[$gt]=` cannot reach a
  // Mongoose query as an operator. Belt and braces alongside the explicit
  // string coercion added in the controllers.
  app.use(mongoSanitize({ replaceWith: '_' }));

  // 'combined' in production; 'dev' is a development format. Neither logs
  // request bodies, so credentials, tokens and webhook payloads stay out of
  // the log stream.
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.use(globalLimiter);

  // No CSRF layer. CSRF exists because browsers attach cookies to cross-site
  // requests automatically; an Authorization header is never sent
  // automatically, so there is nothing for a third-party page to forge.
  // If cookie auth is restored, the CSRF middleware must come back with it.

  // Health check for Render. Deliberately says nothing about the environment.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api', menuRoutes);
  app.use('/api', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () =>
    console.log(
      `🚀 Server on :${env.PORT} (${env.NODE_ENV}, Paystack ${env.PAYSTACK_MODE}) — ` +
        `origins: ${env.CLIENT_ORIGINS.join(', ')}`
    )
  );
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
