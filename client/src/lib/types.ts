export interface Category {
  _id: string;
  slug?: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
}

/** A size tier. The effective price is basePrice + priceDelta. */
export interface Variant {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  minSelect: number;
  /** 0 = unlimited. */
  maxSelect: number;
  templateId?: string | null;
  overridden: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  _id: string;
  /** Stable catalogue identity; absent on admin-created items. */
  slug?: string;
  name: string;
  description?: string;
  category: { _id: string; name: string } | string;
  /** GHS. null = awaiting a real price: not purchasable, no price rendered. */
  basePrice: number | null;
  image: { url: string };
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  /** Populated by the API on /menu, so the configurator can price them inline. */
  addOnItems?: MenuItem[];
  isAvailable: boolean;
  sortOrder?: number;
  isNew: boolean;
  isPopular: boolean;
  preparationTime: number;
}

export interface ModifierGroupTemplate {
  _id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
  usageCount?: number;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItemOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  basePrice: number;
  variant?: { id: string; name: string; priceDelta: number } | null;
  selectedOptions: OrderItemOption[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  specialInstructions?: string;
  /** Pre-configurator orders only. */
  customizations?: string[];
}

export interface Order {
  _id: string;
  orderID: string;
  customer: { name: string; phone: string; email?: string };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: 'card' | 'mobile_money' | 'cash';
  paymentStatus: 'pending' | 'completed' | 'refunded';
  deliveryMethod: 'delivery' | 'pickup';
  deliveryAddress?: string;
  zone?: string;
  estimatedDeliveryTime?: number;
  notes?: string;
  createdAt: string;
}
