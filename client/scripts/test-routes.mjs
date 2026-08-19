/**
 * Route-table assertions for the one-page storefront.
 *
 *   npm --prefix client run test:routes
 *
 * The shop is one page: hero, menu and cart all live at `/`, and the only
 * navigation between landing and paying is the one to /checkout. These tests
 * pin that down so a future "just add a /menu page" cannot pass unnoticed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../src/router.tsx'), 'utf8');

// Read the storefront's route table straight out of the source: this test is
// about what the file declares, so parsing it beats booting a DOM for it.
const storefront = src.slice(src.indexOf('<CustomerLayout />'), src.indexOf('/admin/login'));
const paths = [...storefront.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
const routeOf = (p) => {
  const m = storefront.match(new RegExp(`path: '${p.replace('/', '\\/')}', element: <([A-Za-z]+)`));
  return m?.[1] ?? null;
};

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
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

console.log('one-page storefront routes:');

check('there is no standalone /menu page', () =>
  assert(routeOf('/menu') === 'MenuRedirect', `/menu renders <${routeOf('/menu')}>`)
);
check('there is no /cart page', () =>
  assert(routeOf('/cart') === 'CartRedirect', `/cart renders <${routeOf('/cart')}>`)
);
check('/menu and /cart still resolve (no 404)', () =>
  assert(paths.includes('/menu') && paths.includes('/cart'), 'a retired route was dropped entirely')
);
check('the shop itself is one route', () =>
  assert(routeOf('/') === 'Home', `/ renders <${routeOf('/')}>`)
);
check('/checkout is the only mid-flow navigation', () => {
  // Everything else in the storefront is either the shop, a retired redirect,
  // or post-purchase.
  const postPurchase = ['/order/:id', '/payment/callback', '/track/:orderId', '/track'];
  const retired = ['/menu', '/cart'];
  const midFlow = paths.filter((p) => p !== '/' && !postPurchase.includes(p) && !retired.includes(p));
  assert(
    midFlow.length === 1 && midFlow[0] === '/checkout',
    `expected only /checkout, found ${JSON.stringify(midFlow)}`
  );
});

// The pieces that must be modals/drawers, not routes.
const layout = readFileSync(resolve(here, '../src/components/CustomerLayout.tsx'), 'utf8');
check('the cart is a drawer mounted in the layout', () =>
  assert(layout.includes('<CartDrawer />'), 'CartDrawer is not mounted')
);
check('the configurator is a provider-owned modal', () =>
  assert(layout.includes('ConfiguratorProvider'), 'ConfiguratorProvider is not mounted')
);
check('the mobile cart bar is mounted', () =>
  assert(layout.includes('<MobileCartBar />'), 'MobileCartBar is not mounted')
);

// Chrome that was copied from a many-branch reference site and is being
// reversed. Asserted by file existence — a substring check would match the
// MenuRedirect / MenuManagement names and pass for the wrong reason.
check('the standalone menu page and its chrome are deleted', () => {
  const gone = [
    'src/pages/customer/Menu.tsx',
    'src/pages/customer/Cart.tsx',
    'src/components/MenuPillNav.tsx',   // floating pill nav + branch selector
    'src/components/MenuCartPanel.tsx', // sticky two-column cart panel
    'src/components/MenuCard.tsx',      // the menu page's card
  ];
  const present = gone.filter((f) => existsSync(resolve(here, '..', f)));
  assert(present.length === 0, `still on disk: ${present}`);
});

const nav = readFileSync(resolve(here, '../src/components/Navbar.tsx'), 'utf8');

// The nav used to be asserted link-free, from when the shop collapsed to one
// page. That was too strong: off the homepage the wordmark and Menu MUST be
// real links, or /checkout is a dead end with no way back. The invariant that
// actually matters is narrower — the nav may only point at the shop itself,
// never at some other route.
check('the nav only ever links to the shop', () => {
  // The rebrand's nav builds its links from a LINKS table, so the targets are
  // in that array rather than inline in the JSX. Read both.
  const inline = [...nav.matchAll(/<Link\s+to="([^"]+)"/g)].map((m) => m[1]);
  const table = [...nav.matchAll(/to:\s*'([^']+)'/g)].map((m) => m[1]);
  const offShop = [...inline, ...table].filter((t) => t !== '/' && !t.startsWith('/#'));
  assert(offShop.length === 0, `nav links off the shop: ${JSON.stringify(offShop)}`);
});
check('the nav navigates with anchors, not buttons', () => {
  // cmd-click, middle-click and "open in new tab" all need a real href.
  assert(/<Link\s+to="\/"/.test(nav), 'the wordmark does not link home off the homepage');
  // Off the homepage every section link must be a <Link>, whether it is written
  // inline or driven by the LINKS table.
  assert(
    /<Link[^>]+to=\{link\.to\}/.test(nav) || /<Link\s+to="\/#menu"/.test(nav),
    'the section links do not navigate off the homepage'
  );
  assert(/'\/#menu'/.test(nav), 'nothing points at the menu section');
});
check('the homepage keeps its scroll-only behaviour', () =>
  assert(
    /onClick=\{\(\) => scrollTo\(\)\}/.test(nav) &&
      (/onClick=\{\(\) => scrollTo\(link\.id\)\}/.test(nav) ||
        /onClick=\{\(\) => scrollTo\('menu'\)\}/.test(nav)),
    'the homepage no longer scrolls in place'
  )
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
