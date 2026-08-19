/**
 * Photograph for a menu item.
 *
 * The API carries no image URL for the seeded catalogue — the photography is
 * served statically from client/public/menu and matched by name (see
 * data/menuImages.js). An item that admin uploads a real image for wins over
 * the static match, so a new product isn't stuck without a picture.
 */
import { imageForCategory, srcAt, widthsFor } from '../data/menuImages';
import type { MenuItem } from './types';

type Photo = { file: string; alt: string };

const categoryName = (item: MenuItem): string =>
  typeof item.category === 'string' ? '' : (item.category?.name ?? '');

/**
 * The photo entry for an item: category name first, then the item's own slug.
 *
 * The slug fallback is not redundant. Add-on items arrive from the API as a
 * populated SUBSET of fields that deliberately omits `category`, so a
 * category-only lookup left every upsell tile — in the post-add strip, the cart
 * drawer and checkout — showing a placeholder instead of the food.
 */
function photoFor(item: MenuItem): Photo | null {
  const byCategory = imageForCategory(categoryName(item)) as Photo | null;
  if (byCategory) return byCategory;
  return item.slug ? ((imageForCategory(item.slug) as Photo | null) ?? null) : null;
}

/**
 * The best width the pipeline actually emitted for this file.
 *
 * `srcAt()` builds a path by string template and will happily produce
 * `/menu/opt/burger-640.webp` whether or not that file exists — which is
 * exactly how the configurator ended up 404ing for five of six products while
 * working for the hero by accident. Every request is now resolved against the
 * generated manifest, so an ungenerated width cannot be asked for.
 *
 * Picks the largest generated width at or below the request; if every
 * generated width is larger, takes the smallest of those rather than
 * under-serving the slot.
 */
export function resolveWidth(file: string, requested: number): number {
  const available = (widthsFor(file) as number[]).slice().sort((a, b) => a - b);
  if (available.length === 0) return requested;
  const atOrBelow = available.filter((w) => w <= requested);
  return atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : available[0];
}

/** A URL at the closest generated width, or '' when there is no photo at all. */
export function imageForItem(item: MenuItem, width = 480): string {
  if (item.image?.url) return item.image.url;
  const photo = photoFor(item);
  if (!photo) return '';
  return srcAt(photo.file, resolveWidth(photo.file, width), 'webp') as string;
}

/** Alt text that describes the photograph, falling back to the item name. */
export function altForItem(item: MenuItem): string {
  return item.image?.url ? item.name : (photoFor(item)?.alt ?? item.name);
}
