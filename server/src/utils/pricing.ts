/**
 * Server-side pricing and validation for configured menu lines.
 *
 * This is the only place a line price is ever computed. The client sends
 * selections — ids and quantities — and gets told what it owes; it never gets
 * to assert a price. `priceOrder` also re-checks the client's arithmetic when
 * the client volunteers a total, so a mismatch surfaces as a clear error
 * instead of a silently different charge.
 */
import { Types } from 'mongoose';
import { IMenuItem, IModifierGroup } from '../models/MenuItem';
import { IOrderItem, IOrderItemOption } from '../models/Order';
import { ApiError } from '../middleware/error';

/** Money is GHS with two decimals; keep every intermediate rounded so a long
 *  chain of deltas can't drift a pesewa away from what the customer was shown. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SelectionInput {
  groupId: string;
  optionIds: string[];
}

export interface LineInput {
  menuItemId: string;
  variantId?: string | null;
  selections?: SelectionInput[];
  quantity: number;
  specialInstructions?: string;
}

type PricedItem = IMenuItem & { _id: Types.ObjectId };

/** The variant a line resolves to: the requested one, or the item's default. */
function resolveVariant(item: PricedItem, variantId?: string | null) {
  if (!item.variants?.length) {
    if (variantId) throw new ApiError(400, `${item.name} has no size options`);
    return null;
  }
  if (variantId) {
    const found = item.variants.find((v) => v.id === variantId);
    if (!found) throw new ApiError(400, `Unknown size for ${item.name}`);
    return found;
  }
  // No explicit choice: fall back to the marked default, then the first.
  return item.variants.find((v) => v.isDefault) ?? item.variants[0];
}

/** Enforces required / min / max and that each chosen option still exists and
 *  is available. Returns the frozen option snapshots for the group. */
function resolveGroup(
  item: PricedItem,
  group: IModifierGroup,
  chosenIds: string[]
): IOrderItemOption[] {
  const unique = [...new Set(chosenIds)];

  if (group.type === 'single' && unique.length > 1) {
    throw new ApiError(400, `Choose only one ${group.name} for ${item.name}`);
  }

  const min = group.required ? Math.max(1, group.minSelect || 0) : group.minSelect || 0;
  if (unique.length < min) {
    throw new ApiError(
      400,
      `${item.name}: choose at least ${min} option${min === 1 ? '' : 's'} for ${group.name}`
    );
  }
  // maxSelect 0 means unlimited; a single-select is implicitly capped at one.
  const max = group.type === 'single' ? 1 : group.maxSelect || Infinity;
  if (unique.length > max) {
    throw new ApiError(400, `${item.name}: choose at most ${max} options for ${group.name}`);
  }

  return unique.map((optionId) => {
    const opt = group.options.find((o) => o.id === optionId);
    if (!opt) throw new ApiError(400, `Unknown ${group.name} option for ${item.name}`);
    if (!opt.available) throw new ApiError(400, `${opt.name} is sold out`);
    return {
      groupId: group.id,
      groupName: group.name,
      optionId: opt.id,
      name: opt.name,
      priceDelta: opt.priceDelta || 0,
    };
  });
}

/** Prices and validates a single configured line against the live menu item. */
export function priceLine(item: PricedItem, line: LineInput): IOrderItem {
  if (!item.isAvailable) throw new ApiError(400, `${item.name} is unavailable`);
  // An item with no price yet cannot be ordered — refuse rather than treating
  // a missing price as zero and undercharging.
  if (item.basePrice == null) throw new ApiError(400, `${item.name} is not priced yet`);

  const variant = resolveVariant(item, line.variantId);
  const byGroup = new Map((line.selections ?? []).map((s) => [s.groupId, s.optionIds || []]));

  // Iterate the item's groups, not the client's — a client that omits a
  // required group must fail, not slip through.
  const selectedOptions: IOrderItemOption[] = [];
  for (const group of item.modifierGroups ?? []) {
    selectedOptions.push(...resolveGroup(item, group, byGroup.get(group.id) ?? []));
    byGroup.delete(group.id);
  }
  if (byGroup.size) {
    throw new ApiError(400, `${item.name}: unknown option group in request`);
  }

  const unitPrice = round2(
    item.basePrice +
      (variant?.priceDelta ?? 0) +
      selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0)
  );
  if (unitPrice < 0) throw new ApiError(400, `${item.name} priced below zero`);

  return {
    menuItemId: item._id,
    name: item.name,
    basePrice: item.basePrice,
    variant: variant ? { id: variant.id, name: variant.name, priceDelta: variant.priceDelta } : null,
    selectedOptions,
    unitPrice,
    quantity: line.quantity,
    lineTotal: round2(unitPrice * line.quantity),
    specialInstructions: line.specialInstructions,
  };
}

export interface PricedOrder {
  items: IOrderItem[];
  subtotal: number;
}

/** Prices every line. `expectedSubtotal`, when supplied by the client, must
 *  agree to within a pesewa or the order is refused outright. */
export function priceLines(
  itemsById: Map<string, PricedItem>,
  lines: LineInput[],
  expectedSubtotal?: number
): PricedOrder {
  const items = lines.map((line) => {
    const menuItem = itemsById.get(line.menuItemId);
    if (!menuItem) throw new ApiError(400, `Menu item unavailable: ${line.menuItemId}`);
    return priceLine(menuItem, line);
  });

  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));

  if (expectedSubtotal != null && Math.abs(expectedSubtotal - subtotal) > 0.01) {
    throw new ApiError(
      409,
      `Prices changed while you were ordering. The total is now GH₵${subtotal.toFixed(2)} — ` +
        'please review your cart and try again.'
    );
  }

  return { items, subtotal };
}
