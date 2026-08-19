import { Schema, model, Types } from 'mongoose';

/**
 * A menu item is configurable: a base price, an optional list of size variants
 * (each a delta on the base), and an ordered list of modifier groups (crust,
 * spice level, extra toppings, add-on drinks…).
 *
 * An item with no variants and no groups behaves exactly like a flat product,
 * which is what the original catalogue was — nothing here forces configuration.
 *
 * `addOnItems` is deliberately NOT a modifier group: it points at real sellable
 * MenuItems, so a Coke's price and stock live in one place instead of being
 * copied into every combo that offers one.
 */

/** Stable public id for a subdocument. Generated server-side so the client can
 *  reference an option in a cart line without inventing ids of its own. */
const subId = () => new Types.ObjectId().toString();

export interface IVariant {
  id: string;
  name: string;
  /** GHS added to (or taken off) basePrice. */
  priceDelta: number;
  isDefault: boolean;
}

export interface IModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export type ModifierGroupType = 'single' | 'multi';

export interface IModifierGroup {
  id: string;
  name: string;
  type: ModifierGroupType;
  required: boolean;
  minSelect: number;
  /** 0 = unlimited. Ignored for `single` groups, which are always at most one. */
  maxSelect: number;
  /** Set when this group came from a ModifierGroupTemplate. */
  templateId?: Types.ObjectId | null;
  /** True once an admin edits an attached template's copy locally, which
   *  detaches it from future template updates. */
  overridden: boolean;
  options: IModifierOption[];
}

export interface IMenuItem {
  /** Stable catalogue identity. Set by the catalogue sync; items created by
   *  hand in the admin have none and are never touched by the sync. */
  slug?: string;
  name: string;
  description?: string;
  category: Types.ObjectId;
  /** GHS. null = awaiting a real price: not purchasable, no price rendered. */
  basePrice: number | null;
  image: { url: string; publicId?: string; uploadedAt?: Date };
  variants: IVariant[];
  modifierGroups: IModifierGroup[];
  /** Suggested "add a drink" / "make it a combo" items. */
  addOnItems: Types.ObjectId[];
  isAvailable: boolean;
  sortOrder: number;
  isNew: boolean;
  isPopular: boolean;
  preparationTime: number;
  calories?: number;
  allergens?: string[];
}

export const variantSchema = new Schema<IVariant>(
  {
    id: { type: String, default: subId },
    name: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

export const modifierOptionSchema = new Schema<IModifierOption>(
  {
    id: { type: String, default: subId },
    name: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0 },
    available: { type: Boolean, default: true },
  },
  { _id: false }
);

export const modifierGroupSchema = new Schema<IModifierGroup>(
  {
    id: { type: String, default: subId },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['single', 'multi'], default: 'single' },
    required: { type: Boolean, default: false },
    minSelect: { type: Number, default: 0, min: 0 },
    maxSelect: { type: Number, default: 0, min: 0 },
    templateId: { type: Schema.Types.ObjectId, ref: 'ModifierGroupTemplate', default: null },
    overridden: { type: Boolean, default: false },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { _id: false }
);

const menuItemSchema = new Schema<IMenuItem>(
  {
    // Sparse: admin-created items legitimately have no slug, and several of
    // them must be able to coexist without colliding on a null unique index.
    slug: { type: String, trim: true, index: { unique: true, sparse: true } },
    name: { type: String, required: true, trim: true },
    description: String,
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    // Nullable on purpose: a product can exist before its price is decided.
    // The storefront renders no price and disables ordering while it is null.
    basePrice: { type: Number, min: 0, default: null },
    image: {
      url: { type: String, default: '' },
      /** Cloudinary asset id, so a replaced photo can be cleaned up. */
      publicId: String,
      uploadedAt: Date,
    },
    variants: { type: [variantSchema], default: [] },
    modifierGroups: { type: [modifierGroupSchema], default: [] },
    addOnItems: [{ type: Schema.Types.ObjectId, ref: 'MenuItem' }],
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    isNew: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },
    preparationTime: { type: Number, default: 15 },
    calories: Number,
    allergens: [String],
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ sortOrder: 1 });

export const MenuItem = model<IMenuItem>('MenuItem', menuItemSchema);
