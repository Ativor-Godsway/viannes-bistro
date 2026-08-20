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

  // ── The memories set. These carry a `caption` as well as `alt`, because the
  // gallery draws the caption as a visible label under each card while `alt` is
  // what a screen reader hears. They are two different jobs: the caption is
  // voice, the alt is description, and collapsing them makes one of them bad.
  'garden-lights': {
    file: 'garden-lights',
    caption: 'The garden after dark',
    alt: 'Strings of warm bulbs hung under a large tree over the bistro courtyard at dusk',
  },
  'garden-path': {
    file: 'garden-path',
    caption: 'Walk in',
    alt: 'Two people walking up the lit path into the bistro at night, under heavy green branches',
  },
  'long-lunch': {
    file: 'long-lunch',
    caption: 'Long lunch, longer talk',
    alt: 'Two women talking across a wooden table with plates of food and an open laptop between them',
  },
  'yap-station': {
    file: 'yap-station',
    caption: 'Yap station',
    alt: 'Two friends mid-conversation at a table, one holding a sandwich, iced drinks in front of them',
  },
  'first-bite': {
    file: 'first-bite',
    caption: 'First bite',
    alt: 'A smiling customer in a headwrap taking a drink at a table set with a sandwich and fries',
  },
  'waffles-for-two': {
    file: 'waffles-for-two',
    caption: 'Waffles for two',
    alt: 'Two trays of waffles with ice cream and iced coffees, shared across a table',
  },
  'table-in-the-shade': {
    file: 'table-in-the-shade',
    caption: 'A table in the shade',
    alt: 'A club sandwich and two smoothies on a wooden table under the trees',
  },
  'toasties-and-fries': {
    file: 'toasties-and-fries',
    caption: 'Toasties and fries',
    alt: 'A blue tray of toasted sandwiches with a bowl of fries and ketchup, seen from above',
  },
};

/**
 * The MEMORIES gallery, in display order.
 *
 * One list, read by BOTH the WebGL gallery and the static strip it falls back
 * to — so the two can never disagree about what is in the section. Reordering
 * or adding is an edit here and nowhere else.
 *
 * Opens and closes on the place rather than the food: the bistro is a garden
 * you sit in, and that is the thing the section exists to say.
 */
export const MEMORY_SLUGS = [
  'garden-lights',
  'long-lunch',
  'first-bite',
  'waffles-for-two',
  'yap-station',
  'toasties-and-fries',
  'table-in-the-shade',
  'garden-path',
];

/** The memories, resolved to `{ slug, file, caption, alt }`, in display order. */
export const MEMORIES = MEMORY_SLUGS.map((slug) => ({ slug, ...SITE_PHOTOS[slug] }));

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
 * The smallest derivative that is still at least `targetPx` wide.
 *
 * For the WebGL gallery, which uploads one fixed bitmap per card as a texture
 * and so cannot use `srcset` the way an <img> does. Without this every card
 * downloads its largest derivative on every device — which on a 1× screen is
 * twice the bytes for pixels the GPU immediately throws away.
 */
export const srcNear = (file, targetPx, ext = 'jpg') => {
  const widths = widthsFor(file);
  const pick = widths.find((w) => w >= targetPx) ?? widths[widths.length - 1];
  return `${OPT_DIR}/${file}-${pick}.${ext}`;
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
