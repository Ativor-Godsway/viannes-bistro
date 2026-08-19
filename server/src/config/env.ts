/**
 * Environment validation.
 *
 * Every required variable is checked ONCE, at boot, and the process exits with
 * a list of what is missing rather than starting up and failing later on the
 * first request. The old code fell back to `mongodb://127.0.0.1:27017/viannes`
 * when MONGO_URI was unset, which in production means a server that boots
 * cleanly, connects to nothing, and reports itself healthy.
 *
 * Secrets have NO defaults. A default secret is not a convenience, it is a
 * published credential.
 */
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

/** Comma-separated origins → trimmed array. */
const originList = z
  .string()
  .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean))
  .pipe(z.array(z.string().url()).min(1, 'at least one origin is required'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  MONGO_URI: z
    .string()
    .min(1, 'required — the server will not guess a database')
    .refine((u) => /^mongodb(\+srv)?:\/\//.test(u), 'must be a mongodb:// or mongodb+srv:// URI'),

  // 32 chars minimum: anything shorter is brute-forceable offline, and the old
  // 'dev_secret_change_me' fallback signed real admin sessions.
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  /** Which origins may call this API. A SET — order is not meaningful. */
  CLIENT_ORIGINS: originList,
  /** Optional regex for ephemeral preview deploys, e.g. Vercel's per-PR URLs. */
  CLIENT_ORIGIN_REGEX: z.string().optional(),

  /**
   * WHERE THE BROWSER APP LIVES — a single canonical URL.
   *
   * Deliberately separate from CLIENT_ORIGINS. That is a set answering "who may
   * call us"; this is one value answering "where do we send a paying customer
   * back to". Deriving the second from `CLIENT_ORIGINS[0]` meant reordering a
   * list — an apparently harmless edit — silently changed where customers
   * landed after paying, and a mistake produced a wrong redirect instead of an
   * error.
   *
   * No fallback, for that reason.
   */
  PUBLIC_APP_URL: z
    .string()
    .min(1, 'required — where the browser app is served from, e.g. https://viannes.vercel.app')
    .url('must be an absolute URL including the scheme')
    .transform((u) => u.replace(/\/+$/, '')),

  DELIVERY_FEE_GHS: z.coerce.number().min(0).default(5),
  SYNC_CATALOGUE_ON_BOOT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  PAYSTACK_MODE: z.enum(['test', 'live']).default('test'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  /** Test-only override of the gateway base URL. Refused in live mode. */
  PAYSTACK_BASE_URL: z.string().url().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  /** Hops in front of the app. Render terminates TLS at one proxy. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(isProd ? 1 : 0),
});

export type Env = z.infer<typeof schema>;

function fail(issues: string[]): never {
  console.error(
    '\n✋ Cannot start: the environment is not configured.\n\n' +
      issues.map((i) => `   · ${i}`).join('\n') +
      '\n\n   See server/.env.example for every variable and where to get it.\n'
  );
  process.exit(1);
}

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    fail(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    );
  }
  const env = parsed.data;

  // Cross-field rules that a per-field schema cannot express.
  const problems: string[] = [];

  if (env.NODE_ENV === 'production') {
    if (!env.PAYSTACK_SECRET_KEY) {
      problems.push('PAYSTACK_SECRET_KEY: required in production (card payment would 503)');
    }
    if (env.PAYSTACK_BASE_URL) {
      problems.push('PAYSTACK_BASE_URL: must not be set in production — it is a test hook');
    }
    if (env.CLIENT_ORIGINS.some((o) => o.startsWith('http://'))) {
      problems.push(
        'CLIENT_ORIGINS: plaintext http:// origin in production — SameSite=None cookies require https'
      );
    }
    if (!env.PUBLIC_APP_URL.startsWith('https://')) {
      problems.push(
        'PUBLIC_APP_URL: must be https:// in production — it is where paying customers are sent back to'
      );
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(env.PUBLIC_APP_URL)) {
      problems.push(
        'PUBLIC_APP_URL: points at localhost in production — customers would be redirected to their own machine after paying'
      );
    }
  }

  if (env.PAYSTACK_MODE === 'live') {
    if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_')) {
      problems.push('PAYSTACK_MODE=live but PAYSTACK_SECRET_KEY is a test key');
    }
    if (env.PAYSTACK_BASE_URL) {
      problems.push('PAYSTACK_BASE_URL cannot be overridden in live mode');
    }
  } else if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')) {
    problems.push('A live Paystack key is set but PAYSTACK_MODE is not "live"');
  }

  // Cloudinary is all-or-nothing: two of three credentials is a silent failure
  // at the moment an admin tries to upload a photo.
  const cloudinary = [
    env.CLOUDINARY_CLOUD_NAME,
    env.CLOUDINARY_API_KEY,
    env.CLOUDINARY_API_SECRET,
  ];
  if (cloudinary.some(Boolean) && !cloudinary.every(Boolean)) {
    problems.push(
      'CLOUDINARY_*: set all three of CLOUD_NAME, API_KEY and API_SECRET, or none of them'
    );
  }

  if (env.CLIENT_ORIGIN_REGEX) {
    try {
      new RegExp(env.CLIENT_ORIGIN_REGEX);
    } catch {
      problems.push('CLIENT_ORIGIN_REGEX: not a valid regular expression');
    }
  }

  if (problems.length) fail(problems);

  // Not an error: an app could legitimately be served somewhere that never
  // calls this API. But almost always it is a typo, and the symptom is
  // confusing — the customer lands correctly after paying, then every request
  // from that page is blocked by CORS.
  try {
    const appOrigin = new URL(env.PUBLIC_APP_URL).origin;
    const allowed = env.CLIENT_ORIGINS.some((o) => new URL(o).origin === appOrigin);
    if (!allowed) {
      console.warn(
        `\n⚠️  PUBLIC_APP_URL (${env.PUBLIC_APP_URL}) is not in CLIENT_ORIGINS.\n` +
          '   Customers will be redirected there after paying, and that page will\n' +
          '   then be blocked by CORS on its next API call. Usually a typo.\n'
      );
    }
  } catch {
    /* both are URL-validated above; nothing useful to say if this throws */
  }

  return env;
}

export const env = load();

export const isProduction = env.NODE_ENV === 'production';
export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);
