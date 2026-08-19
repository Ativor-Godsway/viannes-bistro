import { Request, Response } from 'express';
import { z } from 'zod';
import { Order } from '../models/Order';
import { MenuItem } from '../models/MenuItem';
import { ApiError } from '../middleware/error';
import { generateOrderID } from '../utils/orderId';
import { priceLines, round2 } from '../utils/pricing';
import {
  cashCharge,
  initializeTransaction,
  isConfigured as paystackConfigured,
} from '../services/paystack';
import { feeFor } from '../config/fees';
import { env } from '../config/env';
import { emitNewOrder, emitOrderStatus } from '../config/socket';

const TAX_RATE = 0.0; // no tax for campus MVP; adjust as needed

export const createOrderSchema = z
  .object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(5),
    email: z.string().email().optional(),
  }),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1),
        /** Chosen size tier; omitted means "the item's default". */
        variantId: z.string().nullish(),
        selections: z
          .array(z.object({ groupId: z.string(), optionIds: z.array(z.string()) }))
          .optional(),
        specialInstructions: z.string().max(300).optional(),
      })
    )
    .min(1),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  deliveryAddress: z.string().optional(),
  zone: z.string().optional(),
  paymentMethod: z.enum(['card', 'mobile_money', 'cash']),
  notes: z.string().optional(),
  /**
   * Accepted for backwards compatibility and then IGNORED. The fee is computed
   * server-side from the fulfilment method — see config/fees.ts. A client that
   * posts 0 for a delivery order is simply overridden.
   */
  deliveryFee: z.number().min(0).optional(),
  /** What the client believes the subtotal is. Advisory: the server prices the
   *  order itself and rejects the request if these disagree. */
  expectedSubtotal: z.number().min(0).optional(),
  })
  /**
   * Paystack will not open a transaction without a real email address, so it is
   * REQUIRED for card and mobile money and optional for cash on delivery,
   * which never touches the gateway.
   *
   * This used to be optional always, with the controller substituting
   * `<phone>@guest.besties.local` — and `.local` is a reserved non-routable
   * TLD that Paystack rejects outright, so every card payment failed with
   * "Invalid Email Address Passed" before it started.
   */
  .refine((body) => body.paymentMethod === 'cash' || !!body.customer.email, {
    message: 'An email address is required for card and mobile money payments',
    path: ['customer', 'email'],
  });

/** POST /api/orders — guest checkout allowed (req.user optional). */
export async function createOrder(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof createOrderSchema>;

  // Re-price on the server from the DB — never trust client prices. Required
  // groups, min/max counts and option availability are all enforced here too.
  const ids = body.items.map((i) => i.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: ids }, isAvailable: true });
  const byId = new Map(menuItems.map((m) => [String(m._id), m]));

  const { items, subtotal } = priceLines(byId as never, body.items, body.expectedSubtotal);

  // The client's `deliveryFee` is deliberately not consulted.
  const deliveryFee = feeFor(body.deliveryMethod);
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + deliveryFee + tax);

  // Cash never touches the gateway; card and mobile money are initialised
  // against Paystack AFTER the order exists, so the reference has something to
  // reconcile onto and a webhook arriving early still finds its order.
  const reference = generateOrderID();
  const prepTime = Math.max(...menuItems.map((m) => m.preparationTime), 15);

  const order = await Order.create({
    orderID: generateOrderID(),
    customerId: req.user?.id,
    customer: body.customer,
    items,
    subtotal,
    deliveryFee,
    tax,
    total,
    status: 'pending',
    paymentMethod: body.paymentMethod,
    paymentStatus: 'pending',
    paymentReference: body.paymentMethod === 'cash' ? cashCharge(reference).reference : reference,
    deliveryMethod: body.deliveryMethod,
    deliveryAddress: body.deliveryAddress,
    zone: body.zone,
    estimatedDeliveryTime: prepTime + (body.deliveryMethod === 'delivery' ? 15 : 0),
    notes: body.notes,
  });

  let authorizationUrl: string | undefined;
  if (body.paymentMethod !== 'cash') {
    if (!paystackConfigured()) {
      await Order.deleteOne({ _id: order._id });
      throw new ApiError(503, 'Card payment is unavailable right now. Please choose cash.');
    }
    try {
      // `total` here is the server's own arithmetic — see priceLines above.
      const init = await initializeTransaction({
        // Schema-guaranteed for every non-cash method. No synthetic fallback:
        // a made-up address either bounces the receipt or, on a reserved TLD,
        // is refused by the gateway.
        email: body.customer.email!,
        amount: total,
        reference,
        // Where the browser app lives — a dedicated, validated value, not a
        // position in the CORS allowlist. See config/env.ts.
        callbackUrl: `${env.PUBLIC_APP_URL}/payment/callback`,
        metadata: { orderId: String(order._id), orderID: order.orderID },
      });
      authorizationUrl = init.authorizationUrl;
    } catch (err) {
      // No half-placed orders: if the gateway won't take it, the order goes.
      await Order.deleteOne({ _id: order._id });
      throw new ApiError(502, (err as Error).message || 'Could not reach the payment gateway');
    }
  }

  emitNewOrder(order.toObject());
  // The client needs the redirect target alongside the order.
  res.status(201).json({ ...order.toObject(), authorizationUrl });
}

/** GET /api/orders/:id — lookup by human-readable orderID or Mongo _id. */
export async function getOrder(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const order = await Order.findOne({
    $or: [{ orderID: id }, ...(id.match(/^[a-f\d]{24}$/i) ? [{ _id: id }] : [])],
  });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json(order);
}

/** GET /api/customer/orders — authenticated customer's orders. */
export async function listCustomerOrders(req: Request, res: Response): Promise<void> {
  const orders = await Order.find({ customerId: req.user!.id }).sort({ createdAt: -1 });
  res.json(orders);
}

/** PATCH /api/orders/:id/cancel */
export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const order = await Order.findOne({ orderID: req.params.id });
  if (!order) throw new ApiError(404, 'Order not found');
  if (['delivered', 'cancelled', 'out_for_delivery'].includes(order.status)) {
    throw new ApiError(400, `Cannot cancel an order that is ${order.status}`);
  }
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  await order.save();
  emitOrderStatus(order.toObject() as never);
  res.json(order);
}
