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
 * ACCESSIBILITY. A canvas is invisible to assistive technology, so the visible
 * gallery is paired with a visually-hidden list carrying every image's real alt
 * text and caption. That list is also what a crawler and a no-JS reader get.
 * The container itself is a labelled region and is focusable, because the
 * arrow-key handler is useless on something you cannot reach with a keyboard.
 */
import { useEffect, useMemo, useState } from 'react';
import CircularGallery from './ui/CircularGallery';
import MemoriesStrip from './MemoriesStrip';
import Reveal from './ui/Reveal';
import { MEMORIES, srcAt } from '../data/photos';

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

export default function MemoriesSection() {
  // `null` = not yet decided. Deciding in an effect rather than during render
  // keeps the first paint identical on the server-less build and the client,
  // and means the probe never runs during hydration.
  const [useGallery, setUseGallery] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const decide = () => setUseGallery(!media.matches && canUseWebGL());
    decide();
    // Honour the setting being changed while the page is open.
    media.addEventListener('change', decide);
    return () => media.removeEventListener('change', decide);
  }, []);

  // Module-level data mapped once: a fresh array identity on every render would
  // re-run the gallery's effect and rebuild the entire GL scene each time.
  const items = useMemo(
    () => MEMORIES.map((m) => ({ image: srcAt(m.file, 'jpg'), text: m.caption })),
    []
  );

  return (
    <section
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

      {useGallery ? (
        <>
          <div
            role="region"
            aria-label="Photographs from the bistro. Use the left and right arrow keys to move through them."
            tabIndex={0}
            // Explicit height: the canvas has no intrinsic size, and a
            // percentage height against an auto-height parent collapses to 0.
            className="mt-10 h-[380px] w-full outline-offset-4 md:h-[560px]"
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
