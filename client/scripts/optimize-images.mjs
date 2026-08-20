/**
 * Image pipeline for every raster the storefront ships.
 *
 *   npm run images
 *
 * Two source sets, because they are two different kinds of picture and want
 * two different fallbacks:
 *
 *   public/menu/*.png       transparent product cut-outs → WebP + PNG fallback
 *                           (PNG, because the alpha channel is the whole point)
 *   assets-src/photos/*.png lifestyle photographs        → WebP + JPEG fallback
 *                           (JPEG, because they are opaque and PNG triples the
 *                           weight of a photograph for nothing)
 *
 * Derivatives land in `public/<set>/opt/<name>-<width>.<ext>`. The photograph
 * sources live OUTSIDE public/ on purpose: vite copies public/ into dist
 * verbatim, so a multi-megabyte source nobody requests would still be deployed. Widths are the *render*
 * sizes, not the source resolution, and are capped at the source width so the
 * srcset can never claim a candidate that is really smaller than advertised.
 *
 * Sources are left untouched; re-running is idempotent. Metadata (EXIF and
 * everything else) is stripped — sharp drops it unless withMetadata() is called.
 *
 * The photographs are prepared by scripts/prep-photos.mjs first; see that file
 * for why they are cropped on disk rather than in CSS.
 */
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const QUALITY = 82;

// 640 is not optional for the menu set: the item configurator renders the
// product photograph large, and 480 is soft on a retina screen. Before it was
// here, every product except the hero 404'd when the configurator asked for it.
const MENU_WIDTHS = [240, 480, 640];
// The hero product is both the hero object and the first menu category.
const MENU_HERO = { pizza: [640, 1280] };

// The photographs render at ~340px (static strip) up to ~560px (hero frame),
// so 1200 covers the largest at 2×. Sources cap most of these anyway.
const PHOTO_WIDTHS = [480, 800, 1200];

// The memories gallery draws its cards on a GPU cylinder at roughly 400–500px
// of screen width, and every source is capped near 1050px anyway. 1200 would be
// a width no source can supply.
const MEMORY_WIDTHS = [480, 800];

const SETS = [
  {
    name: 'menu',
    dir: path.join(ROOT, 'public', 'menu'),
    out: path.join(ROOT, 'public', 'menu', 'opt'),
    widths: () => MENU_WIDTHS,
    extra: MENU_HERO,
    fallback: 'png',
    manifest: path.join(ROOT, 'src', 'data', 'imageManifest.json'),
  },
  {
    name: 'photos',
    dir: path.join(ROOT, 'assets-src', 'photos'),
    out: path.join(ROOT, 'public', 'photos', 'opt'),
    widths: () => PHOTO_WIDTHS,
    extra: {},
    fallback: 'jpeg',
    manifest: path.join(ROOT, 'src', 'data', 'photoManifest.json'),
  },
  {
    // Shares the photos manifest and the photos data layer on purpose: as far
    // as the app is concerned there is ONE set of editorial photographs, and a
    // second parallel lookup is how a slug ends up resolving in one component
    // and not another. Only the source directory and the widths differ.
    name: 'memories',
    dir: path.join(ROOT, 'assets-src', 'memories'),
    out: path.join(ROOT, 'public', 'photos', 'opt'),
    widths: () => MEMORY_WIDTHS,
    extra: {},
    fallback: 'jpeg',
    manifest: path.join(ROOT, 'src', 'data', 'photoManifest.json'),
  },
];

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

/** Write the fallback in whichever opaque/alpha format this set calls for. */
function encodeFallback(pipeline, format) {
  return format === 'jpeg'
    ? pipeline.jpeg({ quality: QUALITY, mozjpeg: true })
    : pipeline.png({ compressionLevel: 9, palette: true, quality: 85 });
}

/** manifest path → merged { name: widths[] } across every set writing to it. */
const manifests = new Map();

async function runSet(set) {
  const out = set.out;
  await mkdir(out, { recursive: true });
  const files = (await readdir(set.dir)).filter((f) => f.endsWith('.png'));

  let srcTotal = 0;
  let webpTotal = 0;
  let fallbackTotal = 0;
  const rows = [];
  // Shared across sets that write the same manifest — see the memories set.
  const manifest = manifests.get(set.manifest) ?? {};
  manifests.set(set.manifest, manifest);

  for (const file of files) {
    const name = path.basename(file, '.png');
    const srcPath = path.join(set.dir, file);
    srcTotal += (await stat(srcPath)).size;

    const wanted = [...new Set([...set.widths(), ...(set.extra[name] ?? [])])].sort(
      (a, b) => a - b
    );

    // Never claim a width the source can't actually supply: an upscale-capped
    // file emitted as `-1280` would make the browser pick a candidate that is
    // really 800px wide, and the srcset would be a lie.
    const srcWidth = (await sharp(srcPath).metadata()).width;
    const widths = [...new Set(wanted.map((w) => Math.min(w, srcWidth)))].sort((a, b) => a - b);
    if (widths.join() !== wanted.join()) {
      console.log(
        `  note: ${file} is ${srcWidth}px wide — emitting ${widths.join('/')} instead of ${wanted.join('/')}`
      );
    }
    manifest[name] = widths;

    for (const w of widths) {
      const base = sharp(srcPath).resize({ width: w, withoutEnlargement: true });

      const webpPath = path.join(out, `${name}-${w}.webp`);
      await base.clone().webp({ quality: QUALITY, alphaQuality: 90, effort: 6 }).toFile(webpPath);
      const webpSize = (await stat(webpPath)).size;
      webpTotal += webpSize;

      const ext = set.fallback === 'jpeg' ? 'jpg' : 'png';
      const fbPath = path.join(out, `${name}-${w}.${ext}`);
      await encodeFallback(base.clone(), set.fallback).toFile(fbPath);
      const fbSize = (await stat(fbPath)).size;
      fallbackTotal += fbSize;

      rows.push([`${name}-${w}`, kb(webpSize), kb(fbSize)]);
    }
  }

  console.log(`\n  ${set.name}`);
  console.log(`  derivative                webp   ${set.fallback.padStart(8)}`);
  console.log('  ' + '─'.repeat(44));
  for (const [n, w, p] of rows) console.log(`  ${n.padEnd(24)} ${w.padStart(8)} ${p.padStart(10)}`);
  console.log('  ' + '─'.repeat(44));
  console.log(`  source PNGs:      ${kb(srcTotal)}`);
  console.log(`  all webp:         ${kb(webpTotal)}`);
  console.log(`  all fallbacks:    ${kb(fallbackTotal)}`);
}

async function main() {
  for (const set of SETS) await runSet(set);

  // Written once per manifest, after every set that feeds it has run — the app
  // reads these so srcset always matches what actually exists on disk.
  for (const [file, manifest] of manifests) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(file, JSON.stringify(sorted, null, 2) + '\n');
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
