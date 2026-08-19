/**
 * Category → product photograph.
 *
 * Products come from server/src/data/catalogue.ts; this file only maps a
 * category name onto the photograph on disk and its alt text. An entry here is
 * OPTIONAL — a slug the image pipeline has emitted is resolved from the
 * manifest automatically (see imageForCategory), so a new product needs its
 * PNG in public/menu/ and nothing more. Add an entry only to give it better
 * alt text than its own name.
 *
 * `slug` is matched against the API's category name, lowercased with
 * non-alphanumerics collapsed — so "Loaded Fries", "loaded-fries" and
 * "LOADED FRIES" all resolve to the same asset.
 */

/**
 * Widths actually on disk per file, written by scripts/optimize-images.mjs.
 * Read from the manifest rather than hardcoded so srcset can never claim a
 * candidate the pipeline didn't emit (a source smaller than the requested
 * width is capped instead of upscaled).
 */
import MANIFEST from './imageManifest.json';

export const MENU_IMAGES = {
  pizza: { file: 'pizza', alt: 'Wood-fired pizza, whole' },
  burger: { file: 'burger', alt: 'Double stacked beef burger' },
  shawarma: { file: 'shawarma', alt: 'Chicken shawarma wrap, halved' },
  jollof: { file: 'jollof', alt: 'Plate of jollof rice with chicken' },
  indomie: { file: 'indomie', alt: 'Bowl of fried indomie noodles' },
  loadedfries: { file: 'loaded_fries', alt: 'Loaded fries with sauce and toppings' },
};

/** Normalise a category name to a MENU_IMAGES key. */
export const slugify = (name = '') => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Image entry for a category name, or null when there is no photo for it.
 *
 * Falls back to the optimiser's manifest, so adding a product is genuinely two
 * steps: one entry in server/src/data/catalogue.ts, and one photograph dropped
 * in public/menu/<slug>.png followed by `npm run images`. A slug the pipeline
 * has emitted derivatives for resolves here even without an entry in
 * MENU_IMAGES above — that map only exists to supply nicer alt text.
 */
export function imageForCategory(name) {
  const slug = slugify(name);
  if (MENU_IMAGES[slug]) return MENU_IMAGES[slug];
  // The manifest is the ground truth for what is actually on disk.
  if (MANIFEST[slug]) return { file: slug, alt: name };
  return null;
}

/** Where the pipeline writes derivatives; see scripts/optimize-images.mjs. */
export const OPT_DIR = '/menu/opt';

/** Widths available for a file, largest last. */
export const widthsFor = (file) => MANIFEST[file] || [480];

/** The subset a given slot should offer: the hero wants the big ones, menu
 *  blocks the small ones — but never more than the file actually has. */
export function slotWidths(file, priority) {
  const all = widthsFor(file);
  const wanted = priority ? all.filter((w) => w >= 640) : all.filter((w) => w <= 480);
  return wanted.length ? wanted : all;
}

/** srcset string for a file at the given widths, in either format. */
export const srcSet = (file, widths, ext) =>
  widths.map((w) => `${OPT_DIR}/${file}-${w}.${ext} ${w}w`).join(', ');

/** Single source at a specific width — used for the `src` fallback. */
export const srcAt = (file, width, ext = 'png') => `${OPT_DIR}/${file}-${width}.${ext}`;
