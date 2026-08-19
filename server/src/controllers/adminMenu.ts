import { Request, Response } from 'express';
import { z } from 'zod';
import { MenuItem } from '../models/MenuItem';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { ModifierGroupTemplate } from '../models/ModifierGroupTemplate';
import { ApiError } from '../middleware/error';
import { uploadImage, destroyImage, cloudinaryConfigured } from '../config/cloudinary';

/* ---------- Dashboard ---------- */

/** GET /api/admin/dashboard — KPI summary from real order data. */
export async function dashboard(_req: Request, res: Response): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [all, today, statusAgg, revenueAgg, recent] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          today: {
            $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, '$total', 0] },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(10),
  ]);

  const rev = revenueAgg[0] || { total: 0, today: 0, count: 0 };
  const byStatus: Record<string, number> = {};
  statusAgg.forEach((s) => (byStatus[s._id] = s.count));

  res.json({
    orders: { total: all, today, byStatus },
    revenue: {
      total: rev.total,
      today: rev.today,
      avgOrderValue: rev.count ? rev.total / rev.count : 0,
    },
    recent,
  });
}

/* ---------- Menu CRUD ---------- */

export async function listMenu(_req: Request, res: Response): Promise<void> {
  const items = await MenuItem.find()
    .populate('category', 'name displayOrder')
    .populate('addOnItems', 'name basePrice image isAvailable')
    .sort({ sortOrder: 1, createdAt: -1 });
  res.json(items);
}

/** GET /api/admin/menu/:id — one item, fully populated for the editor. */
export async function getMenuItem(req: Request, res: Response): Promise<void> {
  const item = await MenuItem.findById(req.params.id)
    .populate('category', 'name')
    .populate('addOnItems', 'name basePrice image isAvailable');
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json(item);
}

/* ---------- Shared shapes ---------- */

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const optionSchema = z.object({
  // Absent id = a brand-new option; Mongoose fills one in from the schema default.
  id: z.string().optional(),
  name: z.string().min(1),
  priceDelta: z.number().default(0),
  available: z.boolean().default(true),
});

const groupSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1),
    type: z.enum(['single', 'multi']),
    required: z.boolean().default(false),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(0).default(0),
    templateId: objectId.nullish(),
    overridden: z.boolean().default(false),
    options: z.array(optionSchema).min(1, 'A group needs at least one option'),
  })
  .refine((g) => g.maxSelect === 0 || g.maxSelect >= g.minSelect, {
    message: 'maxSelect must be 0 (unlimited) or at least minSelect',
    path: ['maxSelect'],
  })
  .refine((g) => g.minSelect <= g.options.length, {
    message: 'minSelect cannot exceed the number of options',
    path: ['minSelect'],
  });

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().default(false),
});

const menuSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: objectId,
  // Nullable: an item may exist before its price is decided.
  basePrice: z.number().min(0).nullable(),
  isAvailable: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  preparationTime: z.number().min(1).optional(),
  sortOrder: z.number().int().optional(),
  imageUrl: z.string().optional(),
  variants: z.array(variantSchema).optional(),
  modifierGroups: z.array(groupSchema).optional(),
  addOnItems: z.array(objectId).optional(),
});

/** At most one default size, and it must be a real one. */
function normaliseVariants(variants: z.infer<typeof variantSchema>[]) {
  if (!variants.length) return [];
  const firstDefault = variants.findIndex((v) => v.isDefault);
  const idx = firstDefault === -1 ? 0 : firstDefault;
  return variants.map((v, i) => ({ ...v, isDefault: i === idx }));
}

/** Strips the id off options an admin added client-side so the schema default
 *  mints a real one, and keeps existing ids intact. */
function normaliseGroups(groups: z.infer<typeof groupSchema>[]) {
  return groups.map((g) => ({
    ...g,
    minSelect: g.required ? Math.max(1, g.minSelect) : g.minSelect,
    options: g.options.map(({ id, ...rest }) => (id ? { id, ...rest } : rest)),
  }));
}

function buildUpdate(body: Partial<z.infer<typeof menuSchema>>): Record<string, unknown> {
  const update: Record<string, unknown> = { ...body };
  if (body.imageUrl !== undefined) {
    update.image = { url: body.imageUrl, uploadedAt: new Date() };
    delete update.imageUrl;
  }
  if (body.variants) update.variants = normaliseVariants(body.variants);
  if (body.modifierGroups) update.modifierGroups = normaliseGroups(body.modifierGroups);
  return update;
}

export async function createMenuItem(req: Request, res: Response): Promise<void> {
  const body = menuSchema.parse(req.body);
  const item = await MenuItem.create({
    ...buildUpdate(body),
    image: body.imageUrl ? { url: body.imageUrl } : { url: '' },
  });
  res.status(201).json(item);
}

export async function updateMenuItem(req: Request, res: Response): Promise<void> {
  const body = menuSchema.partial().parse(req.body);
  const item = await MenuItem.findByIdAndUpdate(req.params.id, buildUpdate(body), {
    new: true,
    runValidators: true,
  });
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json(item);
}

export async function deleteMenuItem(req: Request, res: Response): Promise<void> {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Menu item not found');
  // Don't leave other items pointing at a product that no longer exists.
  await MenuItem.updateMany({ addOnItems: item._id }, { $pull: { addOnItems: item._id } });
  res.json({ success: true });
}

/** PATCH /api/admin/menu/:id/availability — the fast 86-it toggle. */
export async function setItemAvailability(req: Request, res: Response): Promise<void> {
  const { isAvailable } = z.object({ isAvailable: z.boolean() }).parse(req.body);
  const item = await MenuItem.findByIdAndUpdate(req.params.id, { isAvailable }, { new: true });
  if (!item) throw new ApiError(404, 'Menu item not found');
  res.json(item);
}

/**
 * PATCH /api/admin/menu/:id/groups/:groupId/options/:optionId/availability
 * 86s a single option without touching the rest of the configuration.
 */
export async function setOptionAvailability(req: Request, res: Response): Promise<void> {
  const { available } = z.object({ available: z.boolean() }).parse(req.body);
  const { id, groupId, optionId } = req.params;
  const item = await MenuItem.findById(id);
  if (!item) throw new ApiError(404, 'Menu item not found');
  const group = item.modifierGroups.find((g) => g.id === groupId);
  if (!group) throw new ApiError(404, 'Modifier group not found');
  const option = group.options.find((o) => o.id === optionId);
  if (!option) throw new ApiError(404, 'Modifier option not found');
  option.available = available;
  await item.save();
  res.json(item);
}

/** PATCH /api/admin/menu/reorder — persists drag-to-sort. */
export async function reorderMenu(req: Request, res: Response): Promise<void> {
  const { order } = z.object({ order: z.array(objectId).min(1) }).parse(req.body);
  await MenuItem.bulkWrite(
    order.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { sortOrder: index } },
    }))
  );
  res.json({ success: true, count: order.length });
}

/**
 * POST /api/admin/menu/:id/attach-template — copy a template onto an item.
 *
 * Copy-by-reference: the group carries `templateId`, so the library can show
 * usage and a later `sync` can refresh it, but the item owns a working copy and
 * survives the template being deleted.
 */
export async function attachTemplate(req: Request, res: Response): Promise<void> {
  const { templateId } = z.object({ templateId: objectId }).parse(req.body);
  const [item, template] = await Promise.all([
    MenuItem.findById(req.params.id),
    ModifierGroupTemplate.findById(templateId),
  ]);
  if (!item) throw new ApiError(404, 'Menu item not found');
  if (!template) throw new ApiError(404, 'Template not found');
  if (item.modifierGroups.some((g) => String(g.templateId) === String(template._id))) {
    throw new ApiError(409, `"${template.name}" is already on this item`);
  }

  item.modifierGroups.push({
    name: template.name,
    type: template.type,
    required: template.required,
    minSelect: template.minSelect,
    maxSelect: template.maxSelect,
    templateId: template._id as never,
    overridden: false,
    // Fresh option ids: the item's copy is independent of the template's.
    options: template.options.map((o) => ({
      name: o.name,
      priceDelta: o.priceDelta,
      available: o.available,
    })),
  } as never);
  await item.save();
  res.json(item);
}

/* ---------- Modifier group templates ---------- */

const templateBase = z.object({
  name: z.string().min(1),
  type: z.enum(['single', 'multi']),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(0).default(0),
  options: z.array(optionSchema).min(1),
});

const maxSelectSane = (t: { minSelect?: number; maxSelect?: number }) =>
  !t.maxSelect || t.maxSelect >= (t.minSelect ?? 0);
const MAX_SELECT_MSG = {
  message: 'maxSelect must be 0 (unlimited) or at least minSelect',
  path: ['maxSelect'],
};

const templateSchema = templateBase.refine(maxSelectSane, MAX_SELECT_MSG);
const templatePatchSchema = templateBase.partial().refine(maxSelectSane, MAX_SELECT_MSG);

/** GET /api/admin/modifier-templates — with a live usage count per template. */
export async function listTemplates(_req: Request, res: Response): Promise<void> {
  const [templates, usage] = await Promise.all([
    ModifierGroupTemplate.find().sort({ name: 1 }).lean(),
    MenuItem.aggregate<{ _id: unknown; count: number }>([
      { $unwind: '$modifierGroups' },
      { $match: { 'modifierGroups.templateId': { $ne: null } } },
      { $group: { _id: '$modifierGroups.templateId', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = new Map(usage.map((u) => [String(u._id), u.count]));
  res.json(templates.map((t) => ({ ...t, usageCount: counts.get(String(t._id)) ?? 0 })));
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const body = templateSchema.parse(req.body);
  const template = await ModifierGroupTemplate.create(body);
  res.status(201).json(template);
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  const body = templatePatchSchema.parse(req.body);
  const template = await ModifierGroupTemplate.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  });
  if (!template) throw new ApiError(404, 'Template not found');
  res.json(template);
}

export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  const template = await ModifierGroupTemplate.findByIdAndDelete(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');
  // Attached copies keep working; they just stop tracking anything.
  await MenuItem.updateMany(
    { 'modifierGroups.templateId': template._id },
    { $set: { 'modifierGroups.$[g].templateId': null, 'modifierGroups.$[g].overridden': true } },
    { arrayFilters: [{ 'g.templateId': template._id }] }
  );
  res.json({ success: true });
}

/**
 * POST /api/admin/modifier-templates/:id/sync — push the template's current
 * shape onto every attached copy that hasn't been overridden locally.
 */
export async function syncTemplate(req: Request, res: Response): Promise<void> {
  const template = await ModifierGroupTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');

  const items = await MenuItem.find({
    modifierGroups: { $elemMatch: { templateId: template._id, overridden: false } },
  });
  for (const item of items) {
    for (const group of item.modifierGroups) {
      if (String(group.templateId) !== String(template._id) || group.overridden) continue;
      group.name = template.name;
      group.type = template.type;
      group.required = template.required;
      group.minSelect = template.minSelect;
      group.maxSelect = template.maxSelect;
      // Reuse the existing option id wherever the name still matches, so live
      // carts referencing that option stay valid.
      group.options = template.options.map((o) => {
        const prior = group.options.find((e) => e.name === o.name);
        return {
          ...(prior ? { id: prior.id } : {}),
          name: o.name,
          priceDelta: o.priceDelta,
          available: prior ? prior.available : o.available,
        };
      }) as never;
    }
    await item.save();
  }
  res.json({ success: true, updated: items.length });
}

/**
 * POST /api/admin/menu/:id/upload-image (multipart, field "image")
 *
 * The file goes to Cloudinary and only its permanent https URL is stored. The
 * previous asset is deleted afterwards so replacing a photo repeatedly does
 * not quietly accumulate orphans in the account.
 */
export async function uploadItemImage(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new ApiError(400, 'No image uploaded');
  if (!cloudinaryConfigured) {
    throw new ApiError(503, 'Image uploads are not configured (CLOUDINARY_* env vars missing)');
  }

  const existing = await MenuItem.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Menu item not found');

  const uploaded = await uploadImage(req.file.buffer, req.file.originalname);
  const previousId = existing.image?.publicId;

  existing.image = { url: uploaded.url, publicId: uploaded.publicId, uploadedAt: new Date() };
  await existing.save();

  if (previousId && previousId !== uploaded.publicId) await destroyImage(previousId);

  res.json({ url: uploaded.url, item: existing });
}

/* ---------- Categories ---------- */

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  displayOrder: z.number().optional(),
});

export async function createCategory(req: Request, res: Response): Promise<void> {
  const body = categorySchema.parse(req.body);
  const cat = await Category.create(body);
  res.status(201).json(cat);
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const body = categorySchema.partial().parse(req.body);
  const cat = await Category.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!cat) throw new ApiError(404, 'Category not found');
  res.json(cat);
}

/** A category with items still in it is never silently emptied. */
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const count = await MenuItem.countDocuments({ category: req.params.id });
  if (count) {
    throw new ApiError(
      409,
      `This category still holds ${count} item${count === 1 ? '' : 's'}. Move or delete them first.`
    );
  }
  const cat = await Category.findByIdAndDelete(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  res.json({ success: true });
}

/** PATCH /api/admin/categories/reorder — persists drag-to-sort. */
export async function reorderCategories(req: Request, res: Response): Promise<void> {
  const { order } = z.object({ order: z.array(z.string()).min(1) }).parse(req.body);
  await Category.bulkWrite(
    order.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { displayOrder: index } },
    }))
  );
  res.json({ success: true, count: order.length });
}
