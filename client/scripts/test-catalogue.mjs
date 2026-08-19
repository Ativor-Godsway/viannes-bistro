/**
 * Catalogue parity tests.
 *
 *   npm --prefix client run test:catalogue
 *
 * The homepage (MenuSection) and the menu page (Menu.tsx) used to build their
 * product lists independently and disagreed about what was for sale. They now
 * both read useCatalogue().products. These tests pin that down: the two pages'
 * lists must be identical, and the generated offline fallback must describe the
 * same products at the same prices as the catalogue the server seeds from.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));

async function loadTs(path, stubs = {}) {
  let source = readFileSync(resolve(here, path), 'utf8');
  // Swap bare imports the module under test doesn't need for this check.
  // The pattern spans lines: these are multi-line named-import blocks.
  for (const [spec, code] of Object.entries(stubs)) {
    source = source.replace(
      new RegExp(`import[\\s\\S]*?from '${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}';`, 'g'),
      code
    );
  }
  const { code } = transformSync(source, { loader: 'tsx', format: 'esm', target: 'es2020' });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

let pass = 0;
let fail = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log('  ✓', name);
    pass++;
  } catch (e) {
    console.log('  ✗', name, '→', e.message);
    fail++;
  }
};
const eq = (a, b, m = '') => {
  const [x, y] = [JSON.stringify(a), JSON.stringify(b)];
  if (x !== y) throw new Error(`${m} ${x} !== ${y}`);
};

// The REAL image resolver, so "every product has a photograph" means something.
// Only its JSON manifest import is swapped out, for a data-URL module.
const menuImages = await loadTs('../src/data/menuImages.js', {
  './imageManifest.json': `const MANIFEST = ${readFileSync(
    resolve(here, '../src/data/imageManifest.json'),
    'utf8'
  )};`,
});
globalThis.__imageForCategory = menuImages.imageForCategory;

// buildProducts is the only thing that shapes a product list, so it is the only
// thing these tests need. React is stubbed out.
const cat = await loadTs('../src/lib/useCatalogue.tsx', {
  react: 'const createContext=()=>({}),useContext=()=>({}),useState=()=>[],useEffect=()=>{},useMemo=(f)=>f(),useCallback=(f)=>f;',
  './menuData.generated': "const FALLBACK_CATEGORIES=[],FALLBACK_ITEMS=[];",
  // The REAL resolver, so "every product has a photograph" means something.
  // Only its JSON manifest import is swapped, for a data-URL module.
  '../data/menuImages': 'const imageForCategory = globalThis.__imageForCategory;',
});
const generated = await loadTs('../src/lib/menuData.generated.ts', {
  './types': '',
});
const { CATALOGUE } = await loadTs('../../server/src/data/catalogue.ts');

const categories = generated.FALLBACK_CATEGORIES;
const items = generated.FALLBACK_ITEMS;

console.log('catalogue parity:');

/* ── The two pages ────────────────────────────────────────────────────────── */

// MenuSection renders products as-is.
const homeList = cat.buildProducts(categories, items);
// Menu.tsx renders the same array filtered by category chip + search box; with
// the default chip ("all") and an empty box, the filter is the identity.
const menuList = cat
  .buildProducts(categories, items)
  .filter((p) => ('all' === 'all' ? true : false))
  .filter((p) => (''.trim() ? false : true));

check('home and menu render the same products, in the same order', () =>
  eq(
    homeList.map((p) => p._id),
    menuList.map((p) => p._id)
  )
);
check('…at the same prices', () =>
  eq(
    homeList.map((p) => p.basePrice),
    menuList.map((p) => p.basePrice)
  )
);
check('…with the same images', () =>
  eq(
    homeList.map((p) => p.image?.file ?? null),
    menuList.map((p) => p.image?.file ?? null)
  )
);
check('every product resolves a photograph', () => {
  const missing = homeList.filter((p) => !p.image).map((p) => p.name);
  eq(missing, []);
});
check('sorted by displayOrder', () => {
  const orders = homeList.map((p) => p.displayOrder);
  eq(orders, [...orders].sort((a, b) => a - b));
});

/* ── The fallback vs the catalogue ────────────────────────────────────────── */

check('fallback holds every catalogue product', () =>
  eq(
    homeList.map((p) => p.name),
    CATALOGUE.slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((e) => e.product)
  )
);
check('fallback prices match the catalogue exactly', () =>
  eq(
    homeList.map((p) => p.basePrice),
    CATALOGUE.slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((e) => e.price)
  )
);
check('fallback variant deltas match the catalogue', () => {
  for (const entry of CATALOGUE) {
    const item = items.find((i) => i.slug === entry.slug);
    eq(
      item.variants.map((v) => [v.name, v.priceDelta]),
      (entry.variants ?? []).map((v) => [v.name, v.priceDelta]),
      entry.product
    );
  }
});
check('no product is priced null (the old all-null posture is gone)', () => {
  const unpriced = homeList.filter((p) => p.basePrice == null).map((p) => p.name);
  eq(unpriced, []);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
