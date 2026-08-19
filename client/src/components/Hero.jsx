import PhotoSlot from './ui/PhotoSlot';
import PillButton from './ui/PillButton';
import StickerBadge from './ui/StickerBadge';
import Wordmark from './ui/Wordmark';

/**
 * The hero: cream field, logo lockup, headline, one photograph.
 *
 * ┌─ WHY THIS IS A TWO-COLUMN SPLIT AND NOT A FULL-BLEED BAND ───────────────┐
 * │ The original layout put a 16:9 band under the copy. Not one of the actual │
 * │ photographs is landscape — the widest is 1.3:1 and the rest are portrait  │
 * │ — so a 16:9 frame would have cover-cropped the plate down to a letterbox  │
 * │ sliver of table. The split gives the photo a portrait frame at close to   │
 * │ its own ratio, and gives the copy a column instead of a full-width slab.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Deliberately static. Nothing here animates except the sticker, which stops
 * entirely under `prefers-reduced-motion` — see StickerBadge.
 */
export default function Hero() {
  return (
    <section className="bg-brand-cream px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        {/* ── Left: the copy column. */}
        <div className="min-w-0">
          {/* The full lockup, on cream — the one surface it is cleared for. */}
          <Wordmark
            variant="image"
            priority
            sizes="(max-width: 640px) 200px, 260px"
            className="block h-16 w-auto sm:h-20"
          />

          <p className="mt-8 font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-brown">
            Sandwiches · Hot plates · Smoothies
          </p>

          <h1 className="mt-4 font-poster text-[clamp(2.5rem,9vw,5.5rem)] uppercase leading-[0.88] tracking-tight text-brand-redDeep">
            <span className="block">Made Fresh</span>
            <span className="block">All Day</span>
          </h1>

          <p className="mt-6 max-w-md font-body text-base leading-relaxed text-brand-brown">
            Blended, grilled and plated to order — then carried to you across Legon. Morning,
            afternoon or late.
          </p>

          <PillButton as="a" href="#menu" variant="solid" className="mt-7">
            See the menu
          </PillButton>
        </div>

        {/* ── Right: the photograph, at close to its own portrait ratio. */}
        <div className="relative min-w-0">
          <PhotoSlot
            photo="club-sandwich"
            label="Hero · the plate, on the bench"
            priority
            // Roughly half of the 1152px container on desktop, full bleed below it.
            sizes="(max-width: 767px) 90vw, 530px"
            className="aspect-[4/5] w-full rounded-hero"
          />
          {/*
            Straddles the lower-left corner. The negative inset only kicks in at
            `sm`, where the page gutter is 32px and can absorb it — at 320px a
            -24px offset would push the sticker past the viewport edge and give
            the whole page a horizontal scrollbar.
          */}
          <StickerBadge className="absolute -bottom-7 left-3 h-24 w-24 sm:-left-6 sm:-bottom-8 sm:h-28 sm:w-28" />
        </div>
      </div>
    </section>
  );
}
