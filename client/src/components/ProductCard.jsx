import FoodImage from './FoodImage';
import PillButton from './ui/PillButton';
import { GHS } from '../lib/format';
import { priceRange } from '../lib/pricing';
import { useCart } from '../store/CartContext';
import { useConfigurator } from '../store/ConfiguratorContext';

/**
 * One product card: dish photo on a creamMid panel, name, description, price,
 * and an outline pill that opens the configurator.
 *
 * The tilt treatment is gone with the rest of the old storefront — this design
 * is flat, and a 3D transform on a card softened the type under it anyway.
 *
 * Behaviour is unchanged: the CTA still calls `configure(product.raw)`, and an
 * unpriced item is still unpurchasable rather than merely hidden.
 */
export default function ProductCard({ product }) {
  const { quantityOf } = useCart();
  const { configure } = useConfigurator();
  // Across every configuration of this product — one card, several possible
  // lines, so the badge counts the product rather than any single line.
  const quantity = quantityOf(product._id);
  const priced = product.basePrice != null;
  const range = product.raw ? priceRange(product.raw) : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-brand-brown/20 bg-brand-creamMid">
      {/* Photo well. The catalogue images are transparent cut-outs, so they sit
          directly on the panel with object-contain — no crop, no disc. */}
      <div className="relative aspect-[4/3] w-full">
        {product.image ? (
          <div className="absolute inset-0 grid place-items-center p-6">
            <FoodImage
              file={product.image.file}
              alt={product.image.alt}
              sizes="(max-width: 639px) 88vw, (max-width: 767px) 44vw, 340px"
              seed={product.seed}
              fallbackPalette="orange"
              className="h-full w-full"
            />
          </div>
        ) : (
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="font-display text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-brand-brown/60">
              Photo to come
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5">
        <h3 className="font-poster text-[clamp(1.15rem,3.5vw,1.5rem)] uppercase leading-tight text-brand-redDeep">
          {product.name}
        </h3>

        {product.description && (
          <p className="mt-2 line-clamp-2 font-body text-sm leading-relaxed text-brand-brown">
            {product.description}
          </p>
        )}

        {/* A range means sizes: base+smallest through base+largest, so
            "GH₵90.00 – GH₵247.00" reads as small → large. */}
        <p className="mt-3 font-display text-base font-semibold tabular-nums text-brand-redDeep">
          {priced ? (
            range && range.min !== range.max ? (
              `${GHS(range.min)} – ${GHS(range.max)}`
            ) : (
              GHS(product.basePrice)
            )
          ) : (
            <span className="text-xs uppercase tracking-[0.2em] text-brand-brown/70">
              Coming soon
            </span>
          )}
        </p>

        <PillButton
          variant="outline"
          disabled={!priced || !product.raw}
          onClick={() => configure(product.raw)}
          className="mt-5 w-full"
        >
          {priced ? 'Add to cart' : 'Coming soon'}
          {quantity > 0 && (
            <span
              aria-live="polite"
              className="grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-brand-orange px-1.5 font-display text-[0.7rem] font-bold tabular-nums text-brand-ink"
            >
              {quantity}
            </span>
          )}
        </PillButton>
      </div>
    </article>
  );
}
