/**
 * Origin allowlist, shared by the HTTP CORS layer and Socket.IO.
 *
 * Socket.IO is configured separately from express `cors()`. If only one of them
 * is updated the app appears to work and live order updates silently never
 * arrive — so both read this single list.
 *
 * A wildcard is never used: with `credentials: true` browsers reject
 * `Access-Control-Allow-Origin: *` outright, and the auth cookie would never
 * be sent. Vercel issues a fresh URL per preview deploy, which is what
 * CLIENT_ORIGIN_REGEX is for.
 */
import { env } from './env';

const previewPattern = env.CLIENT_ORIGIN_REGEX ? new RegExp(env.CLIENT_ORIGIN_REGEX) : null;

/** True when `origin` may make credentialed requests to this API. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  // Same-origin requests, curl and server-to-server calls send no Origin
  // header. They are not cross-origin, so CORS has nothing to say about them.
  if (!origin) return true;
  if (env.CLIENT_ORIGINS.includes(origin)) return true;
  return previewPattern ? previewPattern.test(origin) : false;
}

/** Options for `cors()`. */
export const corsOptions = {
  origin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    // Deny by not setting the header — do NOT throw, or a blocked preflight
    // surfaces as a 500 in the logs instead of a plain CORS refusal.
    cb(null, false);
  },
  // The session is a bearer token in a header, not a cookie, so the browser
  // has no credentials to withhold. The allowlist below is still enforced.
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
