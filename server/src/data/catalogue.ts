/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                                                                          ║
   ║   ⚠️  PRICES IN THIS FILE ARE PROVISIONAL PLACEHOLDERS  ⚠️                ║
   ║                                                                          ║
   ║   They were invented to make the ordering flow testable. They are NOT    ║
   ║   real Viannes Bistro prices. REPLACE EVERY `price` AND `priceDelta` BELOW      ║
   ║   BEFORE TAKING REAL MONEY FROM ANYONE.                                  ║
   ║                                                                          ║
   ║   This applies to EVERY number below: the six base prices (each tagged   ║
   ║   `// PLACEHOLDER`) and every variant / option `priceDelta` alongside    ║
   ║   them. None of them has been confirmed by anyone who runs the kitchen.  ║
   ║                                                                          ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */

/**
 * THE CATALOGUE — the single source of truth for what Viannes Bistro sells.
 *
 * This file is the menu. Edit it and restart the server; the boot-time
 * catalogue sync (utils/syncCatalogue.ts) upserts it into MongoDB, and the
 * storefront, the admin and the client's offline fallback all derive from
 * there. Nothing else holds product data, and nothing else may.
 *
 * ┌─ TO ADD A PRODUCT ───────────────────────────────────────────────────────┐
 * │ 1. Add one entry to CATALOGUE below.                                     │
 * │ 2. Drop its photograph in client/public/menu/<slug>.png and run          │
 * │    `npm --prefix client run images`.                                     │
 * │ There is no step 3. Home, menu, search, admin and the offline fallback   │
 * │ all pick it up automatically.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TO CHANGE A PRICE ──────────────────────────────────────────────────────┐
 * │ Edit `price` (the base) or a variant/option `priceDelta` here, then      │
 * │ restart the server. One edit changes the whole site.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `slug` is the stable identity used to match catalogue entries against rows
 * already in the database, so an item keeps its _id — and therefore its order
 * history — across renames. It must also match a key in
 * client/src/data/menuImages.js or the product renders without a photograph.
 */

export interface CatalogueOption {
  name: string;
  /** GHS on top of the line's running price. Default 0. */
  priceDelta?: number;
  available?: boolean;
}

export interface CatalogueGroup {
  name: string;
  type: 'single' | 'multi';
  required?: boolean;
  minSelect?: number;
  /** 0 / omitted = unlimited. */
  maxSelect?: number;
  options: CatalogueOption[];
}

export interface CatalogueVariant {
  name: string;
  priceDelta: number;
  isDefault?: boolean;
}

export interface CatalogueEntry {
  /** Stable identity. Never change this once a product has been ordered. */
  slug: string;
  /** Category label shown on the storefront, oversized. */
  category: string;
  /** Product name listed beneath the label. */
  product: string;
  description?: string;
  /**
   * GHS base price. Currently a PLACEHOLDER for every product — see the banner.
   * null still means "not priced yet": the storefront renders no price and the
   * item cannot be ordered.
   */
  price: number | null;
  icon: string;
  displayOrder: number;
  /** Size tiers. Empty = the item has one size and prices flat. */
  variants?: CatalogueVariant[];
  /** Groups unique to this item. */
  groups?: CatalogueGroup[];
  /** Reusable groups from TEMPLATES, attached by name. */
  templates?: string[];
  /** Other products offered as "add a side / make it a combo", by product name. */
  addOns?: string[];
}

/**
 * Reusable modifier groups. Defined once here, seeded as
 * ModifierGroupTemplate documents, and attached by name to the items below —
 * exactly what the admin template library does at runtime.
 */
export const TEMPLATES: CatalogueGroup[] = [
  {
    name: 'Drinks add-on',
    type: 'multi',
    maxSelect: 3,
    options: [
      { name: 'Coca-Cola 350ml', priceDelta: 10 },
      { name: 'Fanta 350ml', priceDelta: 10 },
      { name: 'Malt', priceDelta: 12 },
      { name: 'Bottled water', priceDelta: 5 },
    ],
  },
  {
    name: 'Spice level',
    type: 'single',
    required: true,
    options: [
      { name: 'Mild', priceDelta: 0 },
      { name: 'Medium', priceDelta: 0 },
      { name: 'Hot', priceDelta: 0 },
      { name: 'Shito extra', priceDelta: 5 },
    ],
  },
  {
    name: 'Sides',
    type: 'multi',
    maxSelect: 2,
    options: [
      { name: 'Coleslaw', priceDelta: 8 },
      { name: 'Fried plantain', priceDelta: 10 },
      { name: 'Side salad', priceDelta: 12 },
    ],
  },
];

export const CATALOGUE: CatalogueEntry[] = [
  {
    slug: 'pizza',
    category: 'Pizza',
    product: 'Pizza',
    description: 'Hand-stretched dough, wood-fired, finished with fresh basil.',
    price: 90, // PLACEHOLDER
    icon: '🍕',
    displayOrder: 1,
    variants: [
      { name: 'Small (9")', priceDelta: 0, isDefault: true },
      { name: 'Medium (12")', priceDelta: 65 },
      { name: 'Large (15")', priceDelta: 157 },
    ],
    groups: [
      {
        name: 'Crust',
        type: 'single',
        required: true,
        options: [
          { name: 'Classic', priceDelta: 0 },
          { name: 'Thin & crispy', priceDelta: 0 },
          { name: 'Stuffed cheese', priceDelta: 25 },
        ],
      },
      {
        name: 'Extra toppings',
        type: 'multi',
        maxSelect: 5,
        options: [
          { name: 'Pepperoni', priceDelta: 15 },
          { name: 'Grilled chicken', priceDelta: 18 },
          { name: 'Mushrooms', priceDelta: 10 },
          { name: 'Green pepper', priceDelta: 8 },
          { name: 'Extra cheese', priceDelta: 12 },
          { name: 'Pineapple', priceDelta: 10 },
        ],
      },
    ],
    templates: ['Drinks add-on'],
    addOns: ['Loaded Fries', 'Shawarma'],
  },
  {
    slug: 'burger',
    category: 'Burger',
    product: 'Burger',
    description: 'Flame-grilled beef patty, brioche bun, house sauce.',
    price: 55, // PLACEHOLDER
    icon: '🍔',
    displayOrder: 2,
    variants: [
      { name: 'Single', priceDelta: 0, isDefault: true },
      { name: 'Double', priceDelta: 30 },
    ],
    groups: [
      {
        name: 'Cheese',
        type: 'single',
        required: true,
        options: [
          { name: 'No cheese', priceDelta: 0 },
          { name: 'Cheddar', priceDelta: 8 },
          { name: 'Blue cheese', priceDelta: 12 },
        ],
      },
      {
        name: 'Extras',
        type: 'multi',
        maxSelect: 4,
        options: [
          { name: 'Bacon', priceDelta: 18 },
          { name: 'Fried egg', priceDelta: 10 },
          { name: 'Jalapeños', priceDelta: 6 },
          { name: 'Caramelised onion', priceDelta: 8 },
        ],
      },
    ],
    templates: ['Drinks add-on', 'Sides'],
    addOns: ['Loaded Fries'],
  },
  {
    slug: 'shawarma',
    category: 'Shawarma',
    product: 'Shawarma',
    description: 'Chicken off the spit, garlic sauce, pickles, warm pita.',
    price: 45, // PLACEHOLDER
    icon: '🌯',
    displayOrder: 3,
    variants: [
      { name: 'Regular', priceDelta: 0, isDefault: true },
      { name: 'Large', priceDelta: 20 },
    ],
    groups: [
      {
        name: 'Protein',
        type: 'single',
        required: true,
        options: [
          { name: 'Chicken', priceDelta: 0 },
          { name: 'Beef', priceDelta: 10 },
          { name: 'Mixed', priceDelta: 15 },
        ],
      },
    ],
    templates: ['Spice level', 'Drinks add-on'],
    addOns: ['Loaded Fries'],
  },
  {
    slug: 'jollof',
    category: 'Jollof',
    product: 'Jollof',
    description: 'Smoky party jollof, slow-cooked in tomato and pepper.',
    price: 50, // PLACEHOLDER
    icon: '🍚',
    displayOrder: 4,
    variants: [
      { name: 'Regular plate', priceDelta: 0, isDefault: true },
      { name: 'Large plate', priceDelta: 22 },
    ],
    groups: [
      {
        name: 'Protein',
        type: 'single',
        required: true,
        options: [
          { name: 'Chicken', priceDelta: 20 },
          { name: 'Grilled fish', priceDelta: 30 },
          { name: 'Goat', priceDelta: 35 },
          { name: 'No protein', priceDelta: 0 },
        ],
      },
    ],
    templates: ['Spice level', 'Sides', 'Drinks add-on'],
    addOns: ['Loaded Fries'],
  },
  {
    slug: 'indomie',
    category: 'Indomie',
    product: 'Indomie',
    description: 'Stir-fried noodles with vegetables, done the campus way.',
    price: 35, // PLACEHOLDER
    icon: '🍜',
    displayOrder: 5,
    groups: [
      {
        name: 'Add protein',
        type: 'multi',
        maxSelect: 3,
        options: [
          { name: 'Fried egg', priceDelta: 10 },
          { name: 'Sausage', priceDelta: 12 },
          { name: 'Chicken strips', priceDelta: 18 },
        ],
      },
    ],
    templates: ['Spice level', 'Drinks add-on'],
    addOns: ['Loaded Fries'],
  },
  {
    slug: 'loadedfries',
    category: 'Loaded Fries',
    product: 'Loaded Fries',
    description: 'Crisp fries under cheese sauce, spring onion and shito drizzle.',
    price: 40, // PLACEHOLDER
    icon: '🍟',
    displayOrder: 6,
    variants: [
      { name: 'Regular', priceDelta: 0, isDefault: true },
      { name: 'Sharing', priceDelta: 25 },
    ],
    groups: [
      {
        name: 'Loading',
        type: 'multi',
        required: true,
        minSelect: 1,
        maxSelect: 3,
        options: [
          { name: 'Cheese sauce', priceDelta: 0 },
          { name: 'Beef chilli', priceDelta: 15 },
          { name: 'Grilled chicken', priceDelta: 15 },
          { name: 'Shito drizzle', priceDelta: 5 },
        ],
      },
    ],
    templates: ['Drinks add-on'],
  },
];
