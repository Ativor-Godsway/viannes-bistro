/**
 * Client-side mirror of the server's line pricing (server/src/utils/pricing.ts).
 *
 * This exists purely so the configurator can show a live price as the customer
 * ticks options. It is never authoritative: checkout sends ids and quantities,
 * and the server prices the order from the database and refuses it if the two
 * disagree. Keep the two files in step.
 */
import type { MenuItem, ModifierGroup, Variant } from './types';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** groupId → chosen option ids. */
export type Selections = Record<string, string[]>;

/** The variant a configuration resolves to: the chosen one, or the default. */
export function resolveVariant(item: MenuItem, variantId?: string | null): Variant | null {
  if (!item.variants?.length) return null;
  return (
    item.variants.find((v) => v.id === variantId) ??
    item.variants.find((v) => v.isDefault) ??
    item.variants[0]
  );
}

/** Unit price for one configured item, or null when the item has no price yet. */
export function unitPrice(
  item: MenuItem,
  variantId?: string | null,
  selections: Selections = {}
): number | null {
  if (item.basePrice == null) return null;
  const variant = resolveVariant(item, variantId);
  const optionsTotal = (item.modifierGroups ?? []).reduce((sum, group) => {
    const chosen = selections[group.id] ?? [];
    return (
      sum +
      chosen.reduce((s, id) => s + (group.options.find((o) => o.id === id)?.priceDelta ?? 0), 0)
    );
  }, 0);
  return round2(item.basePrice + (variant?.priceDelta ?? 0) + optionsTotal);
}

/** Cheapest and dearest a card can advertise — base plus the size deltas only,
 *  so "GH¢90.00 – 247.00" means sizes, not "if you add every topping". */
export function priceRange(item: MenuItem): { min: number; max: number } | null {
  if (item.basePrice == null) return null;
  if (!item.variants?.length) return { min: item.basePrice, max: item.basePrice };
  const deltas = item.variants.map((v) => v.priceDelta);
  return {
    min: round2(item.basePrice + Math.min(...deltas)),
    max: round2(item.basePrice + Math.max(...deltas)),
  };
}

/** How many selections a group still needs, 0 when it is satisfied. */
export function unmetCount(group: ModifierGroup, chosen: string[] = []): number {
  const min = group.required ? Math.max(1, group.minSelect || 0) : group.minSelect || 0;
  return Math.max(0, min - chosen.length);
}

/** The first group blocking "Add to cart", or null when the item is orderable. */
export function firstUnmetGroup(item: MenuItem, selections: Selections): ModifierGroup | null {
  return (item.modifierGroups ?? []).find((g) => unmetCount(g, selections[g.id]) > 0) ?? null;
}

/** True when a group is at its ceiling and further options should be locked. */
export function groupIsFull(group: ModifierGroup, chosen: string[] = []): boolean {
  if (group.type === 'single') return false; // picking another simply replaces.
  return group.maxSelect > 0 && chosen.length >= group.maxSelect;
}

/** Every group's default selection — required single-selects preselect their
 *  first available option so the customer isn't blocked by a formality. */
export function defaultSelections(item: MenuItem): Selections {
  const out: Selections = {};
  for (const group of item.modifierGroups ?? []) {
    out[group.id] = [];
  }
  return out;
}

/**
 * A cart line's identity: item + variant + the sorted set of chosen option ids.
 * Identical configurations collide and merge; any difference keeps them apart.
 */
export function lineKey(
  productId: string,
  variantId: string | null | undefined,
  selections: Selections
): string {
  const optionIds = Object.values(selections).flat().slice().sort();
  return [productId, variantId ?? '-', optionIds.join('.')].join('|');
}

/** Human-readable summary of a configuration, for cart sub-lines. */
export function describeSelections(
  variantName: string | null | undefined,
  optionNames: string[]
): string {
  return [variantName, ...optionNames].filter(Boolean).join(' · ');
}
