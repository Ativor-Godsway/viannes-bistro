import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import MobileCartBar from './MobileCartBar';
import { CatalogueProvider } from '../lib/useCatalogue';
import { CartProvider } from '../store/CartContext';
import { ConfiguratorProvider } from '../store/ConfiguratorContext';

/**
 * The storefront shell.
 *
 * The shop is one page: hero, menu, footer. The configurator is a modal over
 * it and the cart is a drawer over it, so both live here rather than in any
 * route. /checkout is the only real navigation in the whole flow.
 */
export default function CustomerLayout() {
  const { pathname } = useLocation();
  // The homepage carries its own footer inside the menu section's field; the
  // post-purchase pages are plain documents and want the standard one.
  const isHome = pathname === '/';

  return (
    <CatalogueProvider>
      <CartProvider>
        <ConfiguratorProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
              <Outlet />
            </main>
            <Footer />
            <CartDrawer />
            {/* Only on the shop itself. Checkout pins its own pay bar to the
                bottom, and two stacked bars is one too many. */}
            {isHome && <MobileCartBar />}
            {!isHome && (
              <Link
                to="/admin"
                className="fixed bottom-4 left-4 z-admin-link rounded-full bg-charcoal/80 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur transition-colors duration-150 hover:bg-charcoal"
              >
                Admin
              </Link>
            )}
          </div>
        </ConfiguratorProvider>
      </CartProvider>
    </CatalogueProvider>
  );
}
