import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import PlaceholderShape from './PlaceholderShape';
import FoodImage from './FoodImage';
import { BEAT2 } from '../lib/choreo';

/**
 * Poster hero on an explicit 12-column grid.
 *
 *   cols 1–5  top     eyebrow
 *   cols 1–8  middle  display headline
 *   cols 7–12 —       hero object, cropped off the top AND right edges
 *   cols 1–6  bottom  body copy
 *   cols 7–12 bottom  CTA + utility line, right-aligned
 *   col  12   full    vertical rail
 *
 * There is exactly ONE motion effect here: the pizza slides off the screen as
 * you scroll past. Everything else — the headline, the eyebrow, the CTA, the
 * red field — is completely static, on load and on scroll. No entrance
 * timeline, no rotating word, no colour or brightness animation, no parallax
 * on the type. Under `prefers-reduced-motion` even the pizza holds still.
 */
export default function Hero() {
  const root = useRef(null);
  const heroImgRef = useRef(null);

  useLayoutEffect(() => {
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia(root);

    mm.add(
      {
        isMobile: '(prefers-reduced-motion: no-preference) and (max-width: 767px)',
        isDesktop: '(prefers-reduced-motion: no-preference) and (min-width: 768px)',
      },
      (ctx) => {
        const { isMobile } = ctx.conditions;
        const object = q('.hero-object-wrap');
        if (!object.length) return;

        // The pizza travels up and off the top-right as the hero scrolls out.
        // No pin (it fights iOS momentum scrolling) and no rotation — a single
        // scrubbed translation, so the object is perfectly still whenever the
        // user is.
        gsap.to(object, {
          yPercent: isMobile ? BEAT2.disc.m : BEAT2.disc.y,
          xPercent: 35,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom top',
            scrub: BEAT2.scrub,
            invalidateOnRefresh: true,
          },
        });
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <section
      id="hero"
      ref={root}
      className="relative isolate min-h-[100dvh] w-full overflow-hidden bg-brick"
    >
      {/* LAYER 0 — flat red field. No gradient, no texture, no brightness tween. */}
      <div className="absolute inset-0 z-0 bg-brick" />

      {/* LAYER 1 — ambient atmosphere. Almost subliminal: ~5% contrast. */}
      <div className="absolute inset-0 z-[1] opacity-[0.35]">
        <PlaceholderShape
          variant="blob"
          palette="red"
          seed={1}
          speed={13}
          className="absolute -left-[22vw] top-[20vh] h-[70vw] w-[70vw]"
        />
        <PlaceholderShape
          variant="blob"
          palette="red"
          seed={4}
          speed={11}
          className="absolute -right-[20vw] bottom-[-6vh] h-[74vw] w-[74vw]"
        />
      </div>

      {/* LAYER 5 — right rail. Gives the right edge a defined boundary.
          Hidden under 480px, where it only eats width. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] hidden w-7 overflow-hidden min-[480px]:block">
        <div
          aria-hidden
          className="flex h-full select-none items-center justify-center whitespace-nowrap font-body text-[0.58rem] uppercase tracking-[0.35em] text-cream/35"
          style={{ writingMode: 'vertical-rl' }}
        >
          {'DELIVERY · PICKUP · LEGON CAMPUS · '.repeat(6)}
        </div>
      </div>

      {/* LAYER 20 — hero object, cropped off BOTH the top and the right edge, so
          it reads as a print crop rather than a sticker placed on the field.
          This is the one element that moves. */}
      <div className="hero-object-wrap pointer-events-none absolute right-0 top-0 z-20 translate-x-[22%] -translate-y-[26%] will-change-transform sm:translate-x-[15%] sm:-translate-y-[24%]">
        <FoodImage
          file="pizza"
          alt="Wood-fired pizza, whole"
          priority
          sizes="min(88vw, 620px)"
          seed={2}
          fallbackIdle={false}
          imgRef={heroImgRef}
          className="h-[min(88vw,620px)] w-[min(88vw,620px)]"
        />
      </div>

      {/* CONTENT GRID — three rows: top / middle / bottom, 12 columns. */}
      <div className="relative z-10 grid min-h-[100dvh] grid-cols-12 grid-rows-[auto_1fr_auto] gap-y-5 px-5 pb-7 pt-[15vh] sm:px-10 sm:pb-10 sm:pt-[17vh]">
        {/* Eyebrow — cols 1–5, top. Static. */}
        <div className="col-span-5 row-start-1 self-start">
          <span className="block font-body text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-cream sm:text-xs">
            Besties
          </span>
          <span className="mt-1.5 block font-poster text-[0.98rem] uppercase tracking-tight text-cream sm:text-[1.2rem]">
            Fresh. Fast. Fired up.
          </span>
        </div>

        {/* Headline — cols 1–8, middle. Completely static. */}
        <div className="col-span-8 row-start-2 self-center">
          <h1 className="font-poster text-[clamp(3.25rem,15vw,8.5rem)] uppercase leading-[0.82] tracking-[-0.01em] text-cream">
            <span className="block">CAMPUS</span>
            <span className="block">CRAVINGS</span>
          </h1>
        </div>

        {/* Body copy — bottom left. Hard-capped at three lines. */}
        <p className="col-span-7 row-start-3 self-end overflow-hidden text-justify font-body text-[0.7rem] leading-relaxed text-cream [-webkit-box-orient:vertical] [-webkit-line-clamp:3] [display:-webkit-box] sm:col-span-5 sm:text-sm">
          Ghanaian classics, cooked to order and carried across campus hot.
        </p>

        {/* CTA + utility — bottom right, anchoring the right column. Static. */}
        <div className="col-span-5 col-start-8 row-start-3 flex flex-col items-end gap-2 self-end sm:col-span-4 sm:col-start-9">
          <a
            href="#menu"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border-[1.5px] border-cream px-5 py-2.5 font-body text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cream transition-colors duration-150 hover:bg-cream hover:text-brick focus-visible:bg-cream focus-visible:text-brick active:bg-cream active:text-brick sm:px-7 sm:text-xs"
          >
            Order now
          </a>
          <span className="text-right font-body text-[0.6rem] tracking-wide text-cream/85 sm:text-xs">
            0555 000 000 · @bestiesug
          </span>
        </div>
      </div>

      {/* LAYER 30 — script overlay, on top of everything, off-grid. Static. */}
      <div className="pointer-events-none absolute inset-x-0 top-[44vh] z-30 flex justify-start pl-[10vw] sm:pl-[13vw]">
        <span className="block -rotate-6 font-script text-[clamp(3rem,13vw,7rem)] font-bold leading-none text-charcoal">
          fresh
        </span>
      </div>
    </section>
  );
}
