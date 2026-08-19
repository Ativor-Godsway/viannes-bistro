/**
 * Slug → lifestyle photograph.
 *
 * The counterpart to menuImages.js, and deliberately the same shape: nothing in
 * the storefront hardcodes an image path, so re-cropping, renaming or adding a
 * photograph is a change here and nowhere else.
 *
 * These are the *editorial* photographs — the hero frame and the memories row.
 * They are NOT the menu card cut-outs, which live in menuImages.js and are
 * transparent PNGs sitting on a panel rather than cover-cropped photos.
 *
 * Sources: assets-src/photos/<slug>.png, cropped by scripts/prep-photos.mjs.
 * Derivatives: public/photos/opt/, written by scripts/optimize-images.mjs.
 */

/**
 * Widths actually on disk per file, written by scripts/optimize-images.mjs.
 * Read from the manifest rather than hardcoded so srcset can never claim a
 * candidate the pipeline didn't emit — every one of these photographs is
 * smaller than the largest width the pipeline asks for, so they are all capped.
 */
import MANIFEST from './photoManifest.json';

export const SITE_PHOTOS = {
  'club-sandwich': {
    file: 'club-sandwich',
    alt: 'A toasted club sandwich cut into quarters on a black plate, with a bowl of fries and dipping sauce, on a painted wooden bench',
  },
  smoothies: {
    file: 'smoothies',
    alt: 'Four smoothies in clear cups and a jar, lined up on a painted wooden bench in the sun',
  },
  'banana-nutella': {
    file: 'banana-nutella',
    alt: 'A banana and chocolate smoothie in a domed cup, on a painted wooden bench in the sun',
  },
};

/** Where the pipeline writes derivatives; see scripts/optimize-images.mjs. */
export const OPT_DIR = '/photos/opt';

/** Widths available for a file, largest last. */
export const widthsFor = (file) => MANIFEST[file] || [480];

/** srcset string for a file, in either format. */
export const srcSet = (file, ext) =>
  widthsFor(file)
    .map((w) => `${OPT_DIR}/${file}-${w}.${ext} ${w}w`)
    .join(', ');

/** The largest derivative, used as the `src` fallback for browsers ignoring srcset. */
export const srcAt = (file, ext = 'jpg') => {
  const widths = widthsFor(file);
  return `${OPT_DIR}/${file}-${widths[widths.length - 1]}.${ext}`;
};

/**
 * The entry for a slug, or null when there is no such photograph.
 *
 * Falls back to the manifest, so dropping a new file in assets-src/photos/ and
 * re-running the pipeline is enough to light a slot up — an entry above only
 * exists to supply alt text better than the slug.
 */
export function photoFor(slug) {
  if (SITE_PHOTOS[slug]) return SITE_PHOTOS[slug];
  if (MANIFEST[slug]) return { file: slug, alt: slug.replace(/-/g, ' ') };
  return null;
}
