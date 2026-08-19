import { useEffect, useState } from 'react';
import TiltedCard from './TiltedCard';
import FoodImage from './FoodImage';
import { GHS } from '../lib/format';
import { priceRange } from '../lib/pricing';
import { useCart } from '../store/CartContext';
import { useConfigurator } from '../store/ConfiguratorContext';
import { usePrefersReducedMotion } from '../lib/useReducedMotion';
import { srcAt } from '../data/menuImages';

/**
 * One product card: image well on a red disc, name, description, price, ADD.
 *
 * The tilt applies to the IMAGE WELL ONLY. Tilting the price and the button
 * would make them harder to hit and soften the text under the 3D transform.
 *
 * TiltedCard is mouse-only by construction (onMouseMove/Enter/Leave), so on a
 * coarse pointer it would be dead weight — we don't render it at all there and
 * use a press state instead. The branch is decided once, here, not per render
 * inside the grid.
 */

/** True on touch devices. Read once per mount; a pointer type doesn't change
 *  mid-session in practice, but we listen anyway for hybrid devices. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : true
  );
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);
  return coarse;
}

export default function ProductCard({ product }) {
  const { quantityOf } = useCart();
  const { configure } = useConfigurator();
  const coarse = useCoarsePointer();
  const reduced = usePrefersReducedMotion();
  // Across every configuration of this product — one card, several possible
  // lines, so the badge counts the product rather than any single line.
  const quantity = quantityOf(product._id);
  const priced = product.basePrice != null;
  const range = product.raw ? priceRange(product.raw) : null;

  // Tilt only where it can actually work, and never under reduced motion.
  const tilt = !coarse && !reduced;

  const well = (
    <div className="relative aspect-square w-full">
      {/* Red disc behind the cut-out: without a coloured field the transparent
          PNGs float on the cream with nothing anchoring them. The photo
          overflows the disc slightly — that overlap is what makes it composed. */}
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brick" />
      <div className="absolute inset-0 grid place-items-center p-[6%]">
        <FoodImage
          file={product.image.file}
          alt={product.image.alt}
          sizes="(max-width: 359px) 88vw, (max-width: 767px) 44vw, 340px"
          seed={product.seed}
          fallbackPalette="gold"
          className="h-full w-full"
        />
      </div>
    </div>
  );

  return (
    <article className="product-card flex flex-col gap-3 rounded-[20px] border border-charcoal/[0.08] bg-cream p-4">
      {tilt ? (
        // Disc stays flat, photo tilts above it — the cut-out lifts off the
        // plate. Height comes from the aspect-square wrapper, never from a
        // fixed containerHeight, so the card stays fluid at every breakpoint.
        <div className="relative aspect-square w-full">
          <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brick" />
          <TiltedCard
            imageSrc={srcAt(product.image.file, 480, 'png')}
            altText={product.image.alt}
            captionText={product.name}
            containerWidth="100%"
            containerHeight="100%"
            imageWidth="100%"
            imageHeight="100%"
            rotateAmplitude={9}
            scaleOnHover={1.04}
            showMobileWarning={false}
            showTooltip={false}
            displayOverlayContent={false}
            overlayContent={null}
          />
        </div>
      ) : (
        well
      )}

      <div className="flex flex-1 flex-col">
        <h3 className="font-poster text-[clamp(1.1rem,4vw,1.5rem)] uppercase leading-tight text-charcoal">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 font-body text-[0.875rem] text-charcoal/70">
            {product.description}
          </p>
        )}
        {/* Filled price pill — the one piece of the reference site's card
            treatment worth keeping. A range means sizes: base+smallest through
            base+largest, so "GH₵90.00 – GH₵247.00" reads as small → large. */}
        <div className="mt-2">
          {priced ? (
            <span className="inline-flex items-center rounded-full bg-brick px-3 py-1 font-body text-[0.85rem] font-bold tabular-nums text-cream">
              {range && range.min !== range.max
                ? `${GHS(range.min)} – ${GHS(range.max)}`
                : GHS(product.basePrice)}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-charcoal/10 px-3 py-1 font-body text-[0.85rem] font-bold uppercase tracking-wide text-charcoal/60">
              Coming soon
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={!priced || !product.raw}
        onClick={() => configure(product.raw)}
        className="relative h-11 w-full rounded-full bg-brick font-body text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-transform duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {priced ? 'Add' : 'Coming soon'}
        {quantity > 0 && (
          <span
            aria-live="polite"
            className="absolute right-2 top-1/2 grid h-6 min-w-[1.5rem] -translate-y-1/2 place-items-center rounded-full bg-cream px-1.5 font-body text-[0.7rem] font-bold text-brick"
          >
            {quantity}
          </span>
        )}
      </button>
    </article>
  );
}
