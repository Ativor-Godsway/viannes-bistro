/**
 * One-off preparation of the storefront lifestyle photography.
 *
 *   npm run photos:prep
 *
 * Every supplied shot is a SCREENSHOT — of Instagram posts, of stories, or of
 * video frames. The carousel arrows, the app's own sidebar, the mute glyph and
 * several burned-in captions are all baked into the pixels. Cropping them off
 * in CSS would only hide them: the pixels would still ship, and any
 * `object-position` change would bring them straight back. So they are cropped
 * here, once, at prep time, and the cropped file is what the optimiser resizes.
 *
 * Reads the raw screenshots from assets-src/raw/ and writes cropped sources to
 * assets-src/<set>/<slug>.png. Then run `npm run images` to emit the shipped
 * derivatives into public/<set>/opt/.
 *
 * Neither directory is under public/, deliberately: vite copies public/ into
 * dist verbatim, so a multi-megabyte source PNG sitting there would be deployed
 * even though nothing ever requests it.
 *
 * Crops are fractions of the source width/height, so they survive a re-shoot at
 * a different resolution.
 */
import sharp from 'sharp';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'assets-src', 'raw');

/**
 * `left/right/top/bottom` are the fractions to REMOVE from each edge.
 *
 * `ratio`, where given, is enforced AFTER the crop: the box is trimmed
 * symmetrically on whichever axis is long until it hits the ratio exactly. The
 * crops below are hand-measured to land within a percent or two of 3:4 already,
 * so the trim only ever takes off a few pixels — but it means "consistent 3:4"
 * is guaranteed by the script rather than by my arithmetic, which is the whole
 * point when eight frames have to sit in one gallery without jitter.
 */
const SETS = {
  // ── The editorial food photography. See the hero and the static strip.
  photos: [
    // hero.png and image.png are the same photograph at two crops; hero.png is
    // the tighter one and the only one kept.
    { raw: 'hero.png', slug: 'club-sandwich', crop: { left: 0.06, right: 0.06, top: 0, bottom: 0.04 } },
    { raw: 'smoothies.png', slug: 'smoothies', crop: { left: 0.06, right: 0.06, top: 0, bottom: 0.04 } },
    // The words "banana nutella" are burned into the frame at upper-left, and
    // this photo sits directly beside a text label. The extra bottom crop is
    // composition, not cleanup — it pulls the frame back to a portrait close to
    // the other two so the row reads as one set.
    { raw: 'banana-nutella.png', slug: 'banana-nutella', crop: { left: 0.42, right: 0.06, top: 0.2, bottom: 0.18 } },
  ],

  /**
   * ── The MEMORIES gallery. All 3:4, because the gallery lays them out on one
   * cylinder and a mixed bag of ratios reads as a mistake.
   *
   * The screen recording that shipped alongside these is deliberately absent:
   * the gallery takes images only, and a 21MB .mov has no business in the
   * asset pipeline. It is left where it was.
   *
   * Sources are `assets-src/raw/memories/shot-N.png`, numbered in the order the
   * screenshots were taken so the mapping back to the originals survives.
   */
  memories: [
    // Story screenshots: Instagram's own right-hand sidebar (avatars, like
    // count, the mute glyph) and a sliver of the adjacent story on the left.
    { raw: 'memories/shot-6.png', slug: 'garden-lights', ratio: 3 / 4, crop: { left: 0.075, right: 0.13, top: 0.055, bottom: 0.208 } },
    { raw: 'memories/shot-7.png', slug: 'garden-path', ratio: 3 / 4, crop: { left: 0.075, right: 0.13, top: 0.055, bottom: 0.208 } },
    // Video frames with the caption burned in low ("customers enjoying their
    // conversation") and the mute glyph bottom-right.
    { raw: 'memories/shot-3.png', slug: 'long-lunch', ratio: 3 / 4, crop: { left: 0, right: 0.117, top: 0, bottom: 0.32 } },
    // Same, but the caption is burned in at the TOP ("yap station").
    { raw: 'memories/shot-4.png', slug: 'yap-station', ratio: 3 / 4, crop: { left: 0, right: 0.1, top: 0.22, bottom: 0.087 } },
    // A marketing graphic — "Sugar, spice, and everything nice." across the top
    // and a Viannes logo sticker bottom-right. Both cropped out: the gallery
    // draws its own labels, and a second wordmark inside a card fights the one
    // in the navbar.
    { raw: 'memories/shot-1.png', slug: 'first-bite', ratio: 3 / 4, crop: { left: 0.225, right: 0.275, top: 0.34, bottom: 0.155 } },
    // Clean posts — these only need trimming to the common ratio.
    { raw: 'memories/shot-2.png', slug: 'waffles-for-two', ratio: 3 / 4, crop: { left: 0.041, right: 0.041, top: 0, bottom: 0 } },
    { raw: 'memories/shot-8.png', slug: 'table-in-the-shade', ratio: 3 / 4, crop: { left: 0, right: 0, top: 0.073, bottom: 0 } },
    { raw: 'memories/shot-5.png', slug: 'toasties-and-fries', ratio: 3 / 4, crop: { left: 0, right: 0, top: 0.03, bottom: 0.043 } },
  ],
};

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

/** Trim the long axis of `box` symmetrically until width/height === ratio. */
function toRatio(box, ratio) {
  if (!ratio) return box;
  let { left, top, width, height } = box;
  if (width / height > ratio) {
    const want = Math.round(height * ratio);
    left += Math.round((width - want) / 2);
    width = want;
  } else {
    const want = Math.round(width / ratio);
    top += Math.round((height - want) / 2);
    height = want;
  }
  return { left, top, width, height };
}

async function main() {
  for (const [set, shots] of Object.entries(SETS)) {
    const out = path.join(ROOT, 'assets-src', set);
    await mkdir(out, { recursive: true });
    console.log(`\n  ${set}`);

    for (const { raw, slug, crop, ratio } of shots) {
      const src = path.join(RAW, raw);
      const { width, height } = await sharp(src).metadata();

      const region = toRatio(
        {
          left: Math.round(width * crop.left),
          top: Math.round(height * crop.top),
          width: Math.round(width * (1 - crop.left - crop.right)),
          height: Math.round(height * (1 - crop.top - crop.bottom)),
        },
        ratio
      );

      const dest = path.join(out, `${slug}.png`);
      await sharp(src).extract(region).png({ compressionLevel: 9 }).toFile(dest);

      const got = (region.width / region.height).toFixed(3);
      console.log(
        `  ${slug.padEnd(20)} ${width}×${height} ${kb((await stat(src)).size).padStart(9)}` +
          `  →  ${region.width}×${region.height} ${kb((await stat(dest)).size).padStart(9)}  ${got}`
      );
    }
  }
  console.log('\n  now run: npm run images\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
