/**
 * MEMORIES — the band directly above the footer.
 *
 * Two renderings of the same list. Which one you get is decided here, once, and
 * the gallery is never mounted unless all three of these hold:
 *
 *   1. The user has not asked for reduced motion. A ring that drifts under the
 *      pointer is precisely the kind of movement that setting exists to stop,
 *      and the component has no reduced-motion handling of its own.
 *   2. A WebGL context can actually be created. Feature-detected properly —
 *      `'WebGLRenderingContext' in window` is true on machines that will still
 *      hand back null for the context.
 *   3. The context has not since been lost. A lost context leaves a dead grey
 *      canvas, so `onContextLost` swaps permanently to the static strip.
 *
 * In every other case the static strip renders instead. It is not a degraded
 * placeholder — it is the same eight photographs with the same captions, in a
 * layout that works without a GPU.
 *
 * NEITHER rendering is mounted until you are within a screen of the band. This
 * is the last thing on the page and it carries eight photographs; mounting it
 * eagerly pulled ~800KB of JPEG on first paint for a section you have to scroll
 * past the whole menu to reach — and it briefly rendered the strip's <img> tags
 * too, so most of those photographs were fetched TWICE, at two different sizes.
 * The placeholder below reserves the band's height, so deferring it costs no
 * layout shift.
 *
 * ACCESSIBILITY. A canvas is invisible to assistive technology, so the visible
 * gallery is paired with a visually-hidden list carrying every image's real alt
 * text and caption. That list is also what a crawler and a no-JS reader get.
 * The container itself is a labelled region and is focusable, because the
 * arrow-key handler is useless on something you cannot reach with a keyboard.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import CircularGallery from './ui/CircularGallery';
import MemoriesStrip from './MemoriesStrip';
import Reveal from './ui/Reveal';
import { MEMORIES, srcNear } from '../data/photos';

/** Can we actually get a context, not merely name the constructor? */
function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Release it immediately — this probe must not hold one of the browser's
    // limited live contexts open for the lifetime of the page.
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Height of the band's stage. Shared by the gallery and by the placeholder
 *  that stands in for it, so mounting late shifts nothing. */
const STAGE = 'h-[380px] md:h-[560px]';

export default function MemoriesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  // Has the band come within a screen of the viewport yet? Latches true.
  const [near, setNear] = useState(false);
  // `null` = not yet decided. Deciding in an effect rather than during render
  // keeps the first paint identical on the server-less build and the client,
  // and means the probe never runs during hydration.
  const [useGallery, setUseGallery] = useState<boolean | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      // A screen's worth of warning, so textures are decoded by the time the
      // band is actually on screen.
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setUseGallery(!media.matches && canUseWebGL());
    decide();
    // Honour the setting being changed while the page is open.
    media.addEventListener('change', decide);
    return () => media.removeEventListener('change', decide);
  }, []);

  /*
   * Mapped once: a fresh array identity on every render would re-run the
   * gallery's effect and rebuild the entire GL scene.
   *
   * A card is drawn about 400px wide on a desktop stage, so a 1x screen wants
   * the 480 derivative and a 2x screen the 800. The gallery uploads one fixed
   * bitmap per card as a GPU texture and has no `srcset` to fall back on, so
   * the choice has to be made here.
   */
  const items = useMemo(() => {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return MEMORIES.map((m) => ({
      image: srcNear(m.file, 400 * Math.min(dpr, 2), 'jpg'),
      text: m.caption,
    }));
  }, []);

  return (
    <section
      ref={sectionRef}
      id="memories"
      // creamDeep, so the gallery reads as its own band between the cream page
      // and the deep-red footer. overflow-hidden is load-bearing: the ring is
      // wider than the viewport by design.
      className="overflow-hidden bg-brand-creamDeep px-5 py-16 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="font-poster text-[clamp(1.75rem,5vw,3rem)] uppercase leading-tight text-brand-redDeep">
            Memories
          </h2>
          <p className="mt-3 max-w-md font-body text-base text-brand-brown">
            Afternoons, evenings and long lunches under the trees.
          </p>
        </Reveal>
      </div>

      {!near ? (
        // Reserves the band, so mounting late is free of layout shift.
        <div aria-hidden className={`mt-10 w-full ${STAGE}`} />
      ) : useGallery ? (
        <>
          <div
            role="region"
            aria-label="Photographs from the bistro. Use the left and right arrow keys to move through them."
            tabIndex={0}
            // Explicit height: the canvas has no intrinsic size, and a
            // percentage height against an auto-height parent collapses to 0.
            className={`mt-10 w-full outline-offset-4 ${STAGE}`}
          >
            <CircularGallery
              items={items}
              bend={2.5}
              textColor="#733F0F"
              borderRadius={0.06}
              scrollEase={0.03}
              // Poppins is already loaded by index.html. Passing `fontUrl` here
              // would re-fetch the Google stylesheet at runtime for nothing.
              font="600 26px Poppins"
              onContextLost={() => setUseGallery(false)}
            />
          </div>

          {/* The canvas says nothing to a screen reader. This does. */}
          <ul className="sr-only">
            {MEMORIES.map((m) => (
              <li key={m.slug}>
                {m.caption}. {m.alt}
              </li>
            ))}
          </ul>
        </>
      ) : (
        // Also what renders before the probe resolves, so there is never a
        // frame of empty band.
        <MemoriesStrip />
      )}
    </section>
  );
}
