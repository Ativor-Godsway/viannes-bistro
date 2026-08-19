import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { ApiError } from '../middleware/error';
import { emitOrderStatus } from '../config/socket';
import { verifyTransaction, verifyWebhookSignature, toPesewas } from '../services/paystack';

/**
 * Applies a verified Paystack result to an order.
 *
 * IDEMPOTENT, and it has to be: Paystack retries a webhook until it gets a 200,
 * and the customer's browser hits the verify endpoint on top of that. The same
 * reference arriving five times must fulfil exactly once. An order already
 * marked completed short-circuits here.
 *
 * Returns true when this call is the one that actually changed anything.
 */
async function applyPayment(
  reference: string,
  result: { paid: boolean; amount: number; paidAt?: string; channel?: string; status: string }
): Promise<boolean> {
  const order = await Order.findOne({ paymentReference: reference });
  if (!order) return false;

  // Already settled — this is a retry. Do nothing and report success.
  if (order.paymentStatus === 'completed') return false;

  if (!result.paid) {
    if (order.paymentStatus !== 'failed') {
      order.paymentStatus = 'failed';
      await order.save();
      emitOrderStatus(order.toObject() as never);
      return true;
    }
    return false;
  }

  // Guard against a reference being reused for a different (smaller) amount:
  // compare in pesewas so no float ever decides whether someone has paid.
  if (toPesewas(result.amount) !== toPesewas(order.total)) {
    order.paymentStatus = 'failed';
    order.notes = [order.notes, `Payment amount mismatch: gateway reported GH₵${result.amount}, order is GH₵${order.total}`]
      .filter(Boolean)
      .join(' | ');
    await order.save();
    emitOrderStatus(order.toObject() as never);
    return true;
  }

  order.paymentStatus = 'completed';
  order.paidAt = result.paidAt ? new Date(result.paidAt) : new Date();
  order.paymentChannel = result.channel;
  // A paid order is confirmed for the kitchen; it is no longer merely pending.
  if (order.status === 'pending') order.status = 'confirmed';
  await order.save();
  emitOrderStatus(order.toObject() as never);
  return true;
}

/**
 * GET /api/payments/paystack/verify/:reference
 *
 * Called by the client's callback page. It re-asks Paystack rather than
 * believing the browser: the return URL is just a navigation and anyone can
 * visit it with any reference they like.
 */
export async function verify(req: Request, res: Response): Promise<void> {
  const reference = z.string().min(4).parse(req.params.reference);
  const result = await verifyTransaction(reference);
  await applyPayment(reference, result);

  const order = await Order.findOne({ paymentReference: reference });
  if (!order) throw new ApiError(404, 'No order matches that payment reference');
  res.json({ paid: order.paymentStatus === 'completed', status: result.status, order });
}

/**
 * POST /api/payments/paystack/webhook
 *
 * Mounted with express.raw() ahead of the global express.json() (see
 * routes/payment.ts) because the HMAC is computed over the raw bytes.
 *
 * Paystack retries on any non-2xx, so this answers 200 as fast as it can and
 * does the reconciliation afterwards. A handler that did the work first would
 * risk a timeout and a duplicate delivery for no benefit — applyPayment() is
 * idempotent either way.
 */
export async function webhook(req: Request, res: Response): Promise<void> {
  const raw = req.body as Buffer;
  const signature = req.headers['x-paystack-signature'] as string | undefined;

  if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
    // Never acknowledge an unsigned payload — an attacker would learn that the
    // endpoint accepts them.
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let event: { event?: string; data?: { reference?: string; status?: string } };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Malformed payload' });
    return;
  }

  // Acknowledge immediately; Paystack only needs to know we received it.
  res.status(200).json({ received: true });

  if (event.event !== 'charge.success' || !event.data?.reference) return;

  // Re-verify rather than trusting the payload's amount: the signature proves
  // the message came from Paystack, not that we parsed it the way they meant.
  try {
    const result = await verifyTransaction(event.data.reference);
    const changed = await applyPayment(event.data.reference, result);
    console.log(
      `💳 webhook ${event.data.reference}: ${changed ? 'applied' : 'no-op (already settled)'}`
    );
  } catch (err) {
    console.error('Webhook reconciliation failed:', (err as Error).message);
  }
}
