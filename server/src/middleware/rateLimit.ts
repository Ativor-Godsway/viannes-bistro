/**
 * Rate limiting.
 *
 * Nothing was limited before: /api/auth/login could be brute-forced at wire
 * speed and POST /api/orders is unauthenticated, so anyone could flood the
 * kitchen with fake orders (and, once Paystack is live, burn through gateway
 * calls).
 *
 * NOTE ON PROXIES: Render terminates TLS at its edge, so every request reaches
 * the app from the same socket address. Without `app.set('trust proxy', …)` the
 * limiter keys every visitor to one IP and the first burst locks out the whole
 * internet. That is set in index.ts from TRUST_PROXY.
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { isProduction } from '../config/env';

const message = (retryAfterMinutes: number) => ({
  error: `Too many requests. Please try again in about ${retryAfterMinutes} minute${
    retryAfterMinutes === 1 ? '' : 's'
  }.`,
});

/** Generous ceiling for ordinary browsing — a menu page is ~3 calls. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 600 : 10_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(15),
});

/**
 * Credentials: 5 attempts per 15 minutes per IP.
 *
 * Keyed on IP **and** the submitted email, so one attacker cannot lock every
 * account from a shared campus NAT, and a single account cannot be sprayed
 * from one address. Successful logins do not count against the limit.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // ipKeyGenerator normalises IPv6 into a /64 subnet — a bare req.ip lets an
  // attacker with an IPv6 range trivially rotate past the limit.
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  message: message(15),
});

/** Order creation: enough for a real customer, not enough to flood a kitchen. */
export const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: isProduction ? 10 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(10),
});

/** Admin writes — a compromised session should not be able to bulk-destroy. */
export const adminWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: isProduction ? 200 : 10_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(5),
});
