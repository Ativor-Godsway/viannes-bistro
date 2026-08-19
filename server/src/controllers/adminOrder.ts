import { Request, Response } from 'express';
import { z } from 'zod';
import { Order, ORDER_STATUSES } from '../models/Order';
import { ApiError } from '../middleware/error';
import { emitOrderStatus } from '../config/socket';

/** GET /api/admin/orders — filters: status, paymentMethod, deliveryMethod, from, to, search */
export async function listOrders(req: Request, res: Response): Promise<void> {
  // Every one of these lands in a Mongoose filter, so none may be an object.
  // See the note in controllers/menu.ts.
  const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const status = asString(req.query.status);
  const paymentMethod = asString(req.query.paymentMethod);
  const deliveryMethod = asString(req.query.deliveryMethod);
  const from = asString(req.query.from);
  const to = asString(req.query.to);
  const search = asString(req.query.search);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (deliveryMethod) filter.deliveryMethod = deliveryMethod;
  if (from || to) {
    filter.createdAt = {} as Record<string, Date>;
    if (from) (filter.createdAt as Record<string, Date>).$gte = new Date(from);
    if (to) (filter.createdAt as Record<string, Date>).$lte = new Date(to);
  }
  if (search) {
    // Escaped and length-capped: an unescaped user string compiled into a
    // RegExp is both an injection and a ReDoS vector.
    const safe = search.slice(0, 64).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ orderID: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
  }
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json(orders);
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const order = await Order.findOne({ orderID: req.params.id });
  if (!order) throw new ApiError(404, 'Order not found');
  res.json(order);
}

const statusSchema = z.object({ status: z.enum(ORDER_STATUSES as [string, ...string[]]) });

/** PATCH /api/admin/orders/:id/status */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status } = statusSchema.parse(req.body);
  const order = await Order.findOne({ orderID: req.params.id });
  if (!order) throw new ApiError(404, 'Order not found');

  order.status = status as typeof order.status;
  if (status === 'delivered') order.completedAt = new Date();
  if (status === 'cancelled') order.cancelledAt = new Date();
  // Mark card/momo payments completed once fulfilled; cash completes on delivery.
  if (status === 'delivered' && order.paymentStatus === 'pending') {
    order.paymentStatus = 'completed';
  }
  await order.save();

  emitOrderStatus(order.toObject() as never);
  res.json(order);
}

/**
 * DELETE /api/admin/orders/:id
 *
 * Hard delete, by human-readable orderID or Mongo _id. Reserved for clearing
 * test and scratch orders out of a shared database — a real order that needs
 * undoing should be CANCELLED, which keeps the record and the audit trail.
 * A completed payment is refused unless `?force=true` is passed: deleting the
 * only record of money that changed hands should take a deliberate second
 * action, not a stray click. Use it for test transactions and nothing else.
 */
export async function deleteOrder(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const order = await Order.findOne({
    $or: [{ orderID: id }, ...(id.match(/^[a-f\d]{24}$/i) ? [{ _id: id }] : [])],
  });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.paymentStatus === 'completed' && req.query.force !== 'true') {
    throw new ApiError(
      409,
      'This order has been paid. Cancel or refund it instead of deleting the record. ' +
        'If it is a test transaction, re-send with ?force=true.'
    );
  }
  await Order.deleteOne({ _id: order._id });
  res.json({ success: true, orderID: order.orderID });
}
