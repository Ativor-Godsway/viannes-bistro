import { Request, Response } from 'express';
import { MenuItem } from '../models/MenuItem';
import { Category } from '../models/Category';
import { ApiError } from '../middleware/error';

/** GET /api/menu  — filters: category, search, sort */
export async function listMenu(req: Request, res: Response): Promise<void> {
  // Express parses `?category[$gt]=` into an OBJECT, which would reach Mongoose
  // as a query operator. Coercing to string here means the worst an attacker
  // achieves is a category literally named "[object Object]".
  const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const category = asString(req.query.category);
  const search = asString(req.query.search);
  const sort = asString(req.query.sort);
  const filter: Record<string, unknown> = { isAvailable: true };

  if (category && category !== 'all') {
    const cat = await Category.findOne({ name: category });
    if (cat) filter.category = cat._id;
  }
  if (search) filter.$text = { $search: search };

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    // Admin's drag-to-sort order wins inside each popularity tier.
    popular: { isPopular: -1, sortOrder: 1, createdAt: -1 },
    price_asc: { basePrice: 1 },
    price_desc: { basePrice: -1 },
    newest: { createdAt: -1 },
  };
  const sortBy = sortMap[sort || 'popular'] || sortMap.popular;

  const items = await MenuItem.find(filter)
    .populate('category', 'name')
    // Add-on suggestions are rendered inline in the configurator, so the
    // storefront never needs a second round-trip to price them.
    .populate('addOnItems', 'slug name description basePrice image isAvailable variants')
    .sort(sortBy);
  res.json(items);
}

/** GET /api/menu/:id */
export async function getMenuItem(req: Request, res: Response): Promise<void> {
  const item = await MenuItem.findById(req.params.id)
    .populate('category', 'name')
    .populate('addOnItems', 'slug name description basePrice image isAvailable variants');
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json(item);
}

/** GET /api/categories */
export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await Category.find().sort({ displayOrder: 1, name: 1 });
  res.json(categories);
}
