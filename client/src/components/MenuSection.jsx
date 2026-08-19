import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollFloat from './ScrollFloat';
import ProductCard from './ProductCard';
import WaveDivider from './WaveDivider';
import { useCatalogue } from '../lib/useCatalogue';
import { BEAT6 } from '../lib/choreo';

/**
 * The menu on the homepage: one card per product, on a single cream field.
 *
 * Products come from useCatalogue() — the same array the /menu page renders, so
 * the two pages cannot disagree about what is for sale or what it costs.
 * Prices originate in server/src/data/catalogue.ts and reach here through the
 * database; nothing is invented on the client, and this file holds no product
 * data of its own.
 */
export default function MenuSection() {
  const { products, loading } = useCatalogue();
  const root = useRef(null);

  useLayoutEffect(() => {
    if (!root.current || products.length === 0) return;
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia(root);

    // ── Reduced motion: cards are simply present.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(q('.product-card'), { clearProps: 'all' });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // ── BEAT 6 — one trigger for the whole grid; cards rise and stagger.
      // Plays once: no scrub. A scrubbed grid entrance reads badly, and this is
      // now the ONLY scroll-linked motion in the menu.
      //
      // The velocity-skew effect that used to live here (BEAT8) is gone. On a
      // one-page shop you scroll through this section on the way to ordering,
      // and a whole grid shearing as you flick past reads as an effect rather
      // than as feel — which is exactly the bar it failed to clear.
      gsap.from(q('.product-card'), {
        y: BEAT6.y,
        opacity: 0,
        duration: BEAT6.duration,
        ease: 'power3.out',
        stagger: BEAT6.stagger,
        willChange: 'transform, opacity',
        onComplete: () => gsap.set(q('.product-card'), { willChange: 'auto' }),
        scrollTrigger: { trigger: q('.menu-grid')[0], start: BEAT6.start, once: true },
      });
    });

    ScrollTrigger.refresh();
    // Reverting kills every ScrollTrigger and tween this component created.
    return () => mm.revert();
  }, [products.length]);

  return (
    <section
      id="menu"
      ref={root}
      className="relative z-20 bg-creamLt"
      // The bottom padding clears the sticky mobile cart bar, so the last card
      // is always reachable rather than sitting permanently underneath it.
      style={{ paddingBottom: 'calc(6rem + var(--mobile-cart-bar-h, 0px))' }}
    >
      {/* BEAT 4 — the threshold between hero and menu. */}
      <div className="-mt-px">
        <WaveDivider fill="#C2261C" />
      </div>

      <div className="menu-content">
        <header className="mx-auto max-w-[1100px] px-5 pt-6 sm:px-8">
          <ScrollFloat
            animationDuration={1.1}
            ease="back.inOut(2)"
            scrollStart="center bottom+=40%"
            scrollEnd="bottom bottom-=20%"
            stagger={0.045}
            containerClassName="my-0"
            textClassName="font-poster uppercase leading-[0.85] text-brick text-[clamp(3rem,17vw,9rem)]"
          >
            MENU
          </ScrollFloat>
        </header>

        {/*
          1 col <640px · 2 cols 640–767px · 3 cols ≥768px, capped at 1100px.

          Single column on phones on purpose: two poster cards side by side at
          375px leaves each ~155px wide, which wraps the product name and clips
          the description to a couple of words. One card per row is also what
          makes the photograph do its job at the size most people order at.
        */}
        <div className="menu-grid mx-auto mt-8 grid max-w-[1100px] grid-cols-1 gap-5 px-5 sm:grid-cols-2 sm:px-8 md:grid-cols-3 md:gap-8">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>

        {/*
          The API sleeps on Render's free tier and takes 30–60s to wake, so a
          first visit can wait a while. Say the kitchen is warming up rather
          than showing an error — and never show an error here at all: if the
          request fails outright, useCatalogue falls back to the offline
          catalogue and products render anyway.
        */}
        {loading && products.length === 0 && (
          <p
            className="mx-auto mt-10 max-w-[1100px] px-5 text-center font-body text-sm text-charcoal/60 sm:px-8"
            role="status"
            aria-live="polite"
          >
            Warming up the kitchen…
          </p>
        )}
      </div>
    </section>
  );
}
