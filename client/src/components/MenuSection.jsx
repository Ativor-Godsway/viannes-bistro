import ProductCard from './ProductCard';
import { useCatalogue } from '../lib/useCatalogue';

/**
 * The menu on the homepage: one card per product, on a cream field.
 *
 * The data flow is UNCHANGED — products still come from useCatalogue(), which
 * is the single array the whole storefront reads, so nothing here can disagree
 * with the cart or the configurator about what is for sale or what it costs.
 * This file holds no product data of its own and never has.
 *
 * The GSAP entrance and the morphing WaveDivider that used to open this section
 * are gone: the redesign meets the band above with a flat edge, and the cards
 * are simply present.
 */
export default function MenuSection() {
  const { products, loading } = useCatalogue();

  return (
    <section
      id="menu"
      className="bg-brand-cream px-5 py-16 sm:px-8 sm:py-24"
      // Clears the sticky mobile cart bar so the last card is always reachable
      // rather than sitting permanently underneath it.
      style={{ paddingBottom: 'calc(6rem + var(--mobile-cart-bar-h, 0px))' }}
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="font-poster text-[clamp(2.5rem,10vw,6rem)] uppercase leading-[0.9] text-brand-redDeep">
          Menu
        </h2>
        <p className="mt-3 max-w-md font-body text-base text-brand-brown">
          Cooked to order. Pick a plate and we'll get started.
        </p>

        {loading && products.length === 0 ? (
          <p className="mt-12 font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-brown/70">
            Loading the menu…
          </p>
        ) : products.length === 0 ? (
          <p className="mt-12 font-body text-sm text-brand-brown">
            The menu is not available right now. Please try again in a moment.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
