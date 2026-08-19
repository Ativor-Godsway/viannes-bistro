/**
 * Paystack integration.
 *
 * ┌─ MONEY UNITS ────────────────────────────────────────────────────────────┐
 * │ Paystack works in the currency's SUBUNIT. For GHS that is PESEWAS.       │
 * │ GH₵87.00 must be sent as 8700. Getting this wrong charges 100× or 1/100× │
 * │ the real amount, so every conversion goes through toPesewas() and every  │
 * │ amount coming back goes through fromPesewas(). Never multiply by hand.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The amount sent here is always the server-computed total (utils/pricing.ts +
 * the server-side delivery fee). A number from the request body never reaches
 * this file.
 */
import crypto from 'crypto';

export type PaymentMethod = 'card' | 'mobile_money' | 'cash';

/** Kept from the old stub so the order controller didn't need reshaping. */
export interface ChargeResult {
  success: boolean;
  status: 'pending' | 'completed' | 'failed';
  reference: string;
  method: PaymentMethod;
  /** Where to send the customer to pay. Absent for cash. */
  authorizationUrl?: string;
}

/**
 * Paystack's API root. PAYSTACK_BASE_URL exists so the integration can be
 * driven against a local mock in tests — it must never be set in production,
 * and a live-mode key with an overridden base is refused outright below.
 */
const PAYSTACK_BASE = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

/** Live mode is opt-in: a missing or misspelled flag must never mean "live". */
export const isLiveMode = (): boolean => process.env.PAYSTACK_MODE === 'live';

export function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? '';
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  if (isLiveMode() && key.startsWith('sk_test_')) {
    throw new Error('PAYSTACK_MODE=live but PAYSTACK_SECRET_KEY is a test key');
  }
  if (!isLiveMode() && key.startsWith('sk_live_')) {
    throw new Error('A live Paystack key is set but PAYSTACK_MODE is not "live"');
  }
  if (isLiveMode() && process.env.PAYSTACK_BASE_URL) {
    throw new Error('PAYSTACK_BASE_URL cannot be overridden in live mode');
  }
  return key;
}

/** True when Paystack is configured at all. Cash-only still works without it. */
export const isConfigured = (): boolean => !!process.env.PAYSTACK_SECRET_KEY;

/** GHS → pesewas. Rounded, because floating-point cedis are not whole pesewas. */
export const toPesewas = (ghs: number): number => Math.round(ghs * 100);

/** Pesewas → GHS. */
export const fromPesewas = (pesewas: number): number => Math.round(pesewas) / 100;

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

async function call<T>(path: string, init?: RequestInit): Promise<PaystackResponse<T>> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as PaystackResponse<T> | null;
  if (!body) throw new Error(`Paystack returned a non-JSON response (${res.status})`);
  if (!res.ok || !body.status) {
    throw new Error(body.message || `Paystack request failed (${res.status})`);
  }
  return body;
}

export interface InitializeParams {
  email: string;
  /** GHS. Converted to pesewas here — do not pre-multiply. */
  amount: number;
  reference: string;
  /** Where Paystack returns the customer after payment. */
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/** POST /transaction/initialize */
export async function initializeTransaction(
  params: InitializeParams
): Promise<InitializeResult> {
  const { data } = await call<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: toPesewas(params.amount),
      currency: 'GHS',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export interface VerifyResult {
  /** Paystack's own transaction status: 'success', 'failed', 'abandoned', … */
  status: string;
  paid: boolean;
  reference: string;
  /** GHS, converted back from the pesewas Paystack reports. */
  amount: number;
  currency: string;
  paidAt?: string;
  channel?: string;
}

/**
 * GET /transaction/verify/:reference
 *
 * This is the ONLY thing that may mark an order paid. The browser's return from
 * Paystack is a navigation, not a proof of payment — anyone can visit that URL.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const { data } = await call<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    channel?: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  return {
    status: data.status,
    paid: data.status === 'success',
    reference: data.reference,
    amount: fromPesewas(data.amount),
    currency: data.currency,
    paidAt: data.paid_at,
    channel: data.channel,
  };
}

/**
 * Verifies the `x-paystack-signature` header: HMAC-SHA512 of the RAW request
 * body, keyed with the secret key.
 *
 * It must be the raw bytes — a re-serialised JSON object will not produce the
 * same digest. See routes/payment.ts, where the webhook is mounted with
 * express.raw() ahead of the global express.json().
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  // Paystack signs with the secret key; PAYSTACK_WEBHOOK_SECRET is supported as
  // an override for setups that rotate it separately.
  const key = process.env.PAYSTACK_WEBHOOK_SECRET || secretKey();
  const expected = crypto.createHmac('sha512', key).update(rawBody).digest('hex');
  // Constant-time compare, so a wrong signature cannot be found byte by byte.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Cash on delivery — unchanged from the old stub. No gateway call, the order
 * stays pending, and the money is collected at the door.
 */
export function cashCharge(reference: string): ChargeResult {
  return { success: true, status: 'pending', reference, method: 'cash' };
}
