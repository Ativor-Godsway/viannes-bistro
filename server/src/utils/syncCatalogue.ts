/**
 * Catalogue sync — makes `data/catalogue.ts` behave as if it were hardcoded.
 *
 * Runs on server boot (guarded by SYNC_CATALOGUE_ON_BOOT) so editing the
 * catalogue file and restarting is all it takes to change the menu.
 *
 * It is an UPSERT and it never deletes:
 *
 *   · Categories and items are matched by `slug`, so a product keeps its _id —
 *     and therefore every order that references it — across a rename.
 *   · Items in the database that are no longer in the catalogue are marked
 *     `isAvailable: false` and left in place. Deleting them would orphan order
 *     history, and an accidental catalogue edit would be unrecoverable.
 *   · Subdocument ids (variants, groups, options) are preserved by matching on
 *     name, so a live cart referencing an option id stays valid.
 *   · Items created by hand in the admin have no slug and are never touched.
 *
 * Running it twice changes nothing the second time. That property is what makes
 * it safe to run automatically on every boot, including against production.
 */
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { MenuItem, IVariant, IModifierGroup, IModifierOption } from '../models/MenuItem';
import { ModifierGroupTemplate } from '../models/ModifierGroupTemplate';
import { CATALOGUE, TEMPLATES, CatalogueGroup, CatalogueVariant } from '../data/catalogue';

const newId = () => new mongoose.Types.ObjectId().toString();

/** Category slug for an entry — derived, since a category holds one product. */
export const categorySlugOf = (categoryName: string): string =>
  categoryName.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Reuse the existing id whenever a name still matches, so references survive. */
function mergeOptions(
  existing: IModifierOption[] = [],
  desired: CatalogueGroup['options']
): IModifierOption[] {
  return desired.map((o) => {
    const prior = existing.find((e) => e.name === o.name);
    return {
      id: prior?.id ?? newId(),
      name: o.name,
      priceDelta: o.priceDelta ?? 0,
      // An option an admin has 86'd stays 86'd across a restart: availability is
      // an operational decision, not a catalogue one.
      available: prior ? prior.available : (o.available ?? true),
    };
  });
}

function mergeVariants(existing: IVariant[] = [], desired: CatalogueVariant[] = []): IVariant[] {
  return desired.map((v) => ({
    id: existing.find((e) => e.name === v.name)?.id ?? newId(),
    name: v.name,
    priceDelta: v.priceDelta,
    isDefault: v.isDefault ?? false,
  }));
}

function mergeGroup(
  existing: IModifierGroup | undefined,
  desired: CatalogueGroup,
  templateId: mongoose.Types.ObjectId | null
): IModifierGroup {
  return {
    id: existing?.id ?? newId(),
    name: desired.name,
    type: desired.type,
    required: desired.required ?? false,
    minSelect: desired.minSelect ?? (desired.required ? 1 : 0),
    maxSelect: desired.maxSelect ?? 0,
    templateId,
    overridden: false,
    options: mergeOptions(existing?.options, desired.options),
  };
}

export interface SyncReport {
  categoriesUpserted: number;
  itemsUpserted: number;
  templatesUpserted: number;
  /** Items in the DB no longer in the catalogue — hidden, never deleted. */
  retired: string[];
}

export async function syncCatalogue(): Promise<SyncReport> {
  const keepItemIds: mongoose.Types.ObjectId[] = [];

  /* ── Reusable modifier templates first: items attach to them by name. */
  const templateByName = new Map<string, mongoose.Types.ObjectId>();
  const templateSpec = new Map(TEMPLATES.map((t) => [t.name, t]));
  for (const spec of TEMPLATES) {
    const prior = await ModifierGroupTemplate.findOne({ name: spec.name });
    const doc = await ModifierGroupTemplate.findOneAndUpdate(
      { name: spec.name },
      {
        name: spec.name,
        type: spec.type,
        required: spec.required ?? false,
        minSelect: spec.minSelect ?? (spec.required ? 1 : 0),
        maxSelect: spec.maxSelect ?? 0,
        options: mergeOptions(prior?.options, spec.options),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    templateByName.set(spec.name, doc._id as mongoose.Types.ObjectId);
  }

  /* ── Categories and items. */
  const itemIdBySlug = new Map<string, mongoose.Types.ObjectId>();

  for (const entry of CATALOGUE) {
    const categorySlug = categorySlugOf(entry.category);
    // Match on slug, falling back to name so catalogue rows written before
    // slugs existed adopt one instead of being duplicated.
    const category = await Category.findOneAndUpdate(
      { $or: [{ slug: categorySlug }, { name: entry.category }] },
      {
        slug: categorySlug,
        name: entry.category,
        icon: entry.icon,
        displayOrder: entry.displayOrder,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const prior = await MenuItem.findOne({
      $or: [{ slug: entry.slug }, { name: entry.product, category: category._id }],
    });

    // Inline groups first, then attached templates, in catalogue order.
    const groupSpecs: { spec: CatalogueGroup; templateId: mongoose.Types.ObjectId | null }[] = [
      ...(entry.groups ?? []).map((g) => ({ spec: g, templateId: null })),
      ...(entry.templates ?? []).map((name) => {
        const spec = templateSpec.get(name);
        if (!spec) throw new Error(`Unknown modifier template "${name}" on ${entry.product}`);
        return { spec, templateId: templateByName.get(name) ?? null };
      }),
    ];

    const item = await MenuItem.findOneAndUpdate(
      prior ? { _id: prior._id } : { slug: entry.slug },
      {
        slug: entry.slug,
        name: entry.product,
        description: entry.description,
        category: category._id,
        basePrice: entry.price,
        variants: mergeVariants(prior?.variants, entry.variants),
        modifierGroups: groupSpecs.map(({ spec, templateId }) =>
          mergeGroup(prior?.modifierGroups?.find((g) => g.name === spec.name), spec, templateId)
        ),
        sortOrder: entry.displayOrder,
        // A brand-new item arrives available; an existing one keeps whatever
        // the admin last set, so a boot never un-86s something mid-service.
        ...(prior ? {} : { isAvailable: true }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const itemId = item._id as mongoose.Types.ObjectId;
    keepItemIds.push(itemId);
    itemIdBySlug.set(entry.slug, itemId);
  }

  /* ── Second pass: add-on links reference products by name, so every item has
     to exist before any of them can be resolved to an id. */
  const idByProductName = new Map(
    CATALOGUE.map((e) => [e.product, itemIdBySlug.get(e.slug)!] as const)
  );
  for (const entry of CATALOGUE) {
    const self = itemIdBySlug.get(entry.slug)!;
    const addOnItems = (entry.addOns ?? [])
      .map((name) => {
        const id = idByProductName.get(name);
        if (!id) throw new Error(`Unknown add-on product "${name}" on ${entry.product}`);
        return id;
      })
      .filter((id) => String(id) !== String(self));
    await MenuItem.updateOne({ _id: self }, { addOnItems });
  }

  /* ── Retire, never delete. Only catalogue-owned rows (those with a slug) are
     considered: an item an admin created by hand is none of our business. */
  const retiredDocs = await MenuItem.find({
    slug: { $exists: true, $ne: null },
    _id: { $nin: keepItemIds },
    isAvailable: true,
  });
  if (retiredDocs.length) {
    await MenuItem.updateMany(
      { _id: { $in: retiredDocs.map((d) => d._id) } },
      { isAvailable: false }
    );
  }

  return {
    categoriesUpserted: CATALOGUE.length,
    itemsUpserted: CATALOGUE.length,
    templatesUpserted: TEMPLATES.length,
    retired: retiredDocs.map((d) => d.name),
  };
}
