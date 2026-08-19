/**
 * Emits src/lib/menuData.generated.ts from the server's catalogue.
 *
 *   npm --prefix client run catalogue      (also runs automatically on prebuild)
 *
 * The client needs an offline fallback so the storefront still renders when the
 * API is unreachable. Hand-writing that fallback meant two copies of the menu
 * that silently drifted apart — which is exactly what happened, and why the
 * site showed no prices for weeks. Generating it makes drift impossible: the
 * fallback is derived from server/src/data/catalogue.ts at build time, and the
 * file it writes is checked in but never edited by hand.
 *
 * The generator reads the catalogue's TypeScript source and evaluates only its
 * two exported arrays, so the client build needs no dependency on the server
 * package.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/lib/menuData.generated.ts');

/**
 * The catalogue lives in the server workspace. On Vercel, setting the project's
 * Root Directory to `client/` excludes everything above it unless "Include
 * files outside of the Root Directory" is enabled — so this can genuinely be
 * missing at build time.
 *
 * When it is, FAIL LOUDLY. A soft fallback here would ship a stale generated
 * catalogue, and the deployed offline menu would silently disagree with the
 * database — exactly the drift this generator exists to prevent.
 */
const CANDIDATES = [
  resolve(here, '../../server/src/data/catalogue.ts'),
  resolve(process.cwd(), '../server/src/data/catalogue.ts'),
  resolve(process.cwd(), 'server/src/data/catalogue.ts'),
];
const CATALOGUE_SRC = CANDIDATES.find((p) => existsSync(p));

if (!CATALOGUE_SRC) {
  console.error(
    '\n✋ Cannot generate the client catalogue: server/src/data/catalogue.ts was not found.\n\n' +
      '   Looked in:\n' +
      CANDIDATES.map((p) => `     · ${p}`).join('\n') +
      '\n\n   On Vercel this means the build cannot see the server workspace. Either:\n' +
      '     · set the project Root Directory to the REPOSITORY ROOT, or\n' +
      '     · enable "Include files outside of the Root Directory in the Build Step".\n' +
      '\n   Continuing would ship a stale menu that disagrees with the database.\n'
  );
  process.exit(1);
}

/** Strip the types and run the module, so we get the real exported values. */
async function loadCatalogue() {
  // Imported lazily so the missing-catalogue message above is what a
  // misconfigured Vercel build sees, not a module-resolution stack trace.
  const { transformSync } = await import('esbuild');
  const source = readFileSync(CATALOGUE_SRC, 'utf8');
  const { code } = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2020' });
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return import(url);
}

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Mirrors the server's variant/option shape closely enough that the shared
 *  pricing helpers (priceRange, unitPrice) work against it unchanged. */
function toItem(entry, templatesByName) {
  const groups = [
    ...(entry.groups ?? []),
    ...(entry.templates ?? []).map((n) => templatesByName[n]),
  ].filter(Boolean);

  return {
    // Deterministic placeholder ids. These never reach the server: an offline
    // cart is revalidated against the live menu before it can be checked out.
    _id: `offline-${entry.slug}`,
    slug: entry.slug,
    name: entry.product,
    description: entry.description ?? '',
    category: { _id: `offline-cat-${slugify(entry.category)}`, name: entry.category },
    basePrice: entry.price,
    image: { url: '' },
    variants: (entry.variants ?? []).map((v, i) => ({
      id: `${entry.slug}-v${i}`,
      name: v.name,
      priceDelta: v.priceDelta,
      isDefault: v.isDefault ?? false,
    })),
    modifierGroups: groups.map((g, gi) => ({
      id: `${entry.slug}-g${gi}`,
      name: g.name,
      type: g.type,
      required: g.required ?? false,
      minSelect: g.minSelect ?? (g.required ? 1 : 0),
      maxSelect: g.maxSelect ?? 0,
      templateId: null,
      overridden: false,
      options: g.options.map((o, oi) => ({
        id: `${entry.slug}-g${gi}-o${oi}`,
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        available: o.available ?? true,
      })),
    })),
    addOnItems: [],
    isAvailable: true,
    sortOrder: entry.displayOrder,
    isNew: false,
    isPopular: false,
    preparationTime: 15,
  };
}

const { CATALOGUE, TEMPLATES } = await loadCatalogue();
const templatesByName = Object.fromEntries(TEMPLATES.map((t) => [t.name, t]));

const categories = CATALOGUE.map((e) => ({
  _id: `offline-cat-${slugify(e.category)}`,
  name: e.category,
  icon: e.icon,
  displayOrder: e.displayOrder,
})).sort((a, b) => a.displayOrder - b.displayOrder);

const items = CATALOGUE.map((e) => toItem(e, templatesByName)).sort(
  (a, b) => a.sortOrder - b.sortOrder
);

const banner = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written by client/scripts/generate-catalogue.mjs from
 * server/src/data/catalogue.ts. Runs on \`npm run build\` (prebuild) and via
 * \`npm run catalogue\`. Edit the catalogue, not this file.
 *
 * This is the offline fallback: what the storefront renders when the API is
 * unreachable. Because it is generated from the same source the server seeds
 * from, an offline render shows the same products at the same prices as an
 * online one.
 *
 * NOTE: the prices below are the PLACEHOLDER prices from the catalogue. See the
 * banner at the top of server/src/data/catalogue.ts.
 */
import type { Category, MenuItem } from './types';

`;

const body =
  `export const FALLBACK_CATEGORIES: Category[] = ${JSON.stringify(categories, null, 2)};\n\n` +
  `export const FALLBACK_ITEMS: MenuItem[] = ${JSON.stringify(items, null, 2)};\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, banner + body);
console.log(
  `📦 menuData.generated.ts — ${items.length} items, ${categories.length} categories from catalogue.ts`
);
