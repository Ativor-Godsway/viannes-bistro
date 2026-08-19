/**
 * One-off image pipeline for the storefront food photography.
 *
 *   npm run images
 *
 * Reads the source cut-outs from public/menu/*.png and emits optimised
 * derivatives next to them in public/menu/opt/:
 *
 *   <name>-<width>.webp   quality 82, alpha preserved
 *   <name>-<width>.png    resized PNG fallback for <picture>
 *
 * Widths are the *render* sizes, not the source resolution:
 *   hero (pizza) → 640 / 1280   (renders at min(85vw, 620px))
 *   menu shapes  → 240 / 480    (render at ~140–200px)
 * pizza gets all four because it is both the hero object and the first
 * menu category.
 *
 * Sources are left untouched; re-running is idempotent. Metadata (EXIF and
 * everything else) is stripped — sharp drops it unless withMetadata() is called.
 */
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public', 'menu');
const OUT = path.join(SRC, 'opt');

const HERO = 'pizza';
const HERO_WIDTHS = [640, 1280];
// 640 is not optional: the item configurator renders the product photograph
// large, and 480 is soft on a retina screen. Before it was here, every product
// except the hero 404'd when the configurator asked for -640.
const MENU_WIDTHS = [240, 480, 640];
const QUALITY = 82;

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png'));

  let srcTotal = 0;
  let webpTotal = 0;
  let pngTotal = 0;
  const rows = [];
  const manifest = {};

  for (const file of files) {
    const name = path.basename(file, '.png');
    const srcPath = path.join(SRC, file);
    srcTotal += (await stat(srcPath)).size;

    const wanted = name === HERO ? [...MENU_WIDTHS, ...HERO_WIDTHS] : MENU_WIDTHS;

    // Never claim a width the source can't actually supply: an upscale-capped
    // file emitted as `-1280` would make the browser pick a candidate that is
    // really 800px wide, and the srcset would be a lie.
    const srcWidth = (await sharp(srcPath).metadata()).width;
    const widths = [...new Set(wanted.map((w) => Math.min(w, srcWidth)))].sort((a, b) => a - b);
    if (widths.join() !== wanted.join()) {
      console.log(`  note: ${file} is ${srcWidth}px wide — emitting ${widths.join('/')} instead of ${wanted.join('/')}`);
    }
    manifest[name] = widths;

    for (const w of widths) {
      const base = sharp(srcPath).resize({ width: w, withoutEnlargement: true });

      const webpPath = path.join(OUT, `${name}-${w}.webp`);
      await base.clone().webp({ quality: QUALITY, alphaQuality: 90, effort: 6 }).toFile(webpPath);
      const webpSize = (await stat(webpPath)).size;
      webpTotal += webpSize;

      const pngPath = path.join(OUT, `${name}-${w}.png`);
      await base.clone().png({ compressionLevel: 9, palette: true, quality: 85 }).toFile(pngPath);
      const pngSize = (await stat(pngPath)).size;
      pngTotal += pngSize;

      rows.push([`${name}-${w}`, kb(webpSize), kb(pngSize)]);
    }
  }

  // The app reads this so srcset always matches what actually exists on disk.
  const manifestPath = path.join(ROOT, 'src', 'data', 'imageManifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log('\n  derivative            webp        png');
  console.log('  ' + '─'.repeat(40));
  for (const [n, w, p] of rows) console.log(`  ${n.padEnd(20)} ${w.padStart(8)} ${p.padStart(10)}`);
  console.log('  ' + '─'.repeat(40));
  console.log(`  source PNGs:      ${kb(srcTotal)}`);
  console.log(`  all webp:         ${kb(webpTotal)}`);
  console.log(`  all png fallback: ${kb(pngTotal)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
