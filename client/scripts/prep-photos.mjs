/**
 * One-off preparation of the storefront lifestyle photography.
 *
 *   npm run photos:prep
 *
 * Every supplied shot is an INSTAGRAM SCREENSHOT: the carousel arrows and the
 * dot indicators are baked into the pixels at the edges, and one of them has a
 * caption burned into the frame. Cropping them off in CSS would only hide them
 * — the pixels would still ship, and any `object-position` change would bring
 * them back. So they are cropped here, once, at prep time, and the cropped file
 * is what the optimiser resizes.
 *
 * Reads the raw screenshots from assets-src/raw/ and writes cropped sources to
 * assets-src/photos/<slug>.png. Then run `npm run images` to emit the shipped
 * derivatives into public/photos/opt/.
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
const OUT = path.join(ROOT, 'assets-src', 'photos');

/**
 * `left/right/top/bottom` are the fractions to REMOVE from each edge.
 *
 * The baseline everywhere is the outer 6% left and right (carousel arrows) and
 * the bottom 4% (dot indicators). `banana-nutella` needs much more off the left
 * and top: the words "banana nutella" are burned into the frame at upper-left,
 * and this photo is used in the memories row directly beside a text label. The
 * extra bottom crop is composition, not cleanup — it pulls the frame back to a
 * portrait close to the other two so the memories row reads as one set.
 */
const SHOTS = [
  // hero.png and image.png are the same photograph at two crops; hero.png is
  // the tighter one and the only one kept.
  { raw: 'hero.png', slug: 'club-sandwich', crop: { left: 0.06, right: 0.06, top: 0, bottom: 0.04 } },
  { raw: 'smoothies.png', slug: 'smoothies', crop: { left: 0.06, right: 0.06, top: 0, bottom: 0.04 } },
  { raw: 'banana-nutella.png', slug: 'banana-nutella', crop: { left: 0.42, right: 0.06, top: 0.2, bottom: 0.18 } },
];

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const { raw, slug, crop } of SHOTS) {
    const src = path.join(RAW, raw);
    const { width, height } = await sharp(src).metadata();

    const left = Math.round(width * crop.left);
    const top = Math.round(height * crop.top);
    const region = {
      left,
      top,
      width: Math.round(width * (1 - crop.left - crop.right)),
      height: Math.round(height * (1 - crop.top - crop.bottom)),
    };

    const dest = path.join(OUT, `${slug}.png`);
    await sharp(src).extract(region).png({ compressionLevel: 9 }).toFile(dest);

    console.log(
      `  ${slug.padEnd(16)} ${width}×${height} ${kb((await stat(src)).size)}` +
        `  →  ${region.width}×${region.height} ${kb((await stat(dest)).size)}`
    );
  }
  console.log('\n  now run: npm run images\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
