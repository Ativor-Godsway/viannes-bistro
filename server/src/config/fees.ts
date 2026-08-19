/**
 * Delivery fees — SERVER AUTHORITATIVE.
 *
 * The fee used to be taken from the request body, which meant a client could
 * post `deliveryFee: 0` and be charged nothing to deliver. Now the request's
 * fee (if any) is ignored entirely and the number is computed here, from the
 * fulfilment method, before it reaches the order total or Paystack.
 *
 * client/src/lib/fees.ts mirrors these numbers for display. If you change one,
 * change both — the client's copy is only ever a preview of what the server
 * will decide.
 */
export type DeliveryMethod = 'delivery' | 'pickup';

/** GHS. Override with DELIVERY_FEE_GHS without a redeploy. */
export const DELIVERY_FEE = Number(process.env.DELIVERY_FEE_GHS ?? 5);

/** Pickup is free, always. */
export function feeFor(method: DeliveryMethod): number {
  return method === 'delivery' ? DELIVERY_FEE : 0;
}
