import { Schema, model, Document, Types } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

/** A modifier option exactly as it was when the order was placed. */
export interface IOrderItemOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

/**
 * An immutable snapshot of one configured line. Every name and every delta is
 * frozen here — an order must never re-derive its price from the live menu,
 * or last week's receipts change when someone edits a topping.
 */
export interface IOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  /** Base price at time of order, before variant and modifier deltas. */
  basePrice: number;
  variant?: { id: string; name: string; priceDelta: number } | null;
  selectedOptions: IOrderItemOption[];
  /** basePrice + variant delta + sum of option deltas. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  specialInstructions?: string;
  /** Kept for orders written before the configurable-item model landed. */
  customizations?: string[];
}

export interface IOrder extends Document {
  orderID: string;
  customerId?: Types.ObjectId;
  customer: { name: string; phone: string; email?: string };
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'card' | 'mobile_money' | 'cash';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  /** Paystack transaction reference. Unique, so a retried webhook can find it. */
  paymentReference?: string;
  paidAt?: Date;
  paymentChannel?: string;
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddress?: string;
  zone?: string;
  estimatedDeliveryTime?: number;
  notes?: string;
  completedAt?: Date;
  cancelledAt?: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderID: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
    },
    items: [
      {
        _id: false,
        menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        basePrice: { type: Number, default: 0 },
        variant: {
          type: new Schema(
            { id: String, name: String, priceDelta: Number },
            { _id: false }
          ),
          default: null,
        },
        selectedOptions: {
          type: [
            new Schema(
              {
                groupId: String,
                groupName: String,
                optionId: String,
                name: String,
                priceDelta: Number,
              },
              { _id: false }
            ),
          ],
          default: [],
        },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, min: 1 },
        lineTotal: { type: Number, required: true },
        specialInstructions: String,
        customizations: [String],
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    paymentMethod: { type: String, enum: ['card', 'mobile_money', 'cash'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentReference: { type: String, index: { unique: true, sparse: true } },
    paidAt: Date,
    paymentChannel: String,
    deliveryMethod: { type: String, enum: ['delivery', 'pickup'], default: 'delivery' },
    deliveryAddress: String,
    zone: String,
    estimatedDeliveryTime: Number,
    notes: String,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
