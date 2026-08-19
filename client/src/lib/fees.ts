/**
 * Delivery fee, in GHS — DISPLAY ONLY.
 *
 * THE SERVER IS AUTHORITATIVE. server/src/config/fees.ts computes the real fee
 * from the fulfilment method, ignores anything the client posts, and includes
 * it in the total sent to Paystack. This file exists so checkout can show the
 * customer a number before the order is placed; if the two ever disagree, the
 * server's figure is the one charged.
 *
 * Keep in step with server/src/config/fees.ts (and DELIVERY_FEE_GHS).
 */
export const DELIVERY_FEE = 5;

/** Fee for a fulfilment method. Pickup is free, always. */
export const feeFor = (method: 'delivery' | 'pickup'): number =>
  method === 'delivery' ? DELIVERY_FEE : 0;
