import PhotoSlot from './ui/PhotoSlot';
import { MEMORIES } from '../data/photos';

/**
 * The static memories row — the fallback the WebGL gallery falls back TO.
 *
 * Not a degraded placeholder: same eight photographs, same captions, same
 * order, in a layout that needs no GPU and no motion. It renders for anyone who
 * has asked for reduced motion, anyone without WebGL, and for the moment before
 * the probe in MemoriesSection resolves.
 *
 * It no longer owns a <section> or a heading — MemoriesSection provides both,
 * so the two renderings sit under one band and one <h2> rather than each
 * declaring their own.
 *
 * Three across on desktop; below `sm` a horizontal scroller with snap points,
 * because eight portrait photos stacked is most of a screen each.
 */
export default function MemoriesStrip() {
  return (
    <div className="mx-auto max-w-6xl">
      {/*
        One element, two behaviours: a snapping flex scroller below `sm`, a
        three-column grid from `sm` up. Negative margins let the row scroll edge
        to edge while its first card still lines up with the page gutter.
      */}
      <ul className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
        {MEMORIES.map(({ slug, caption, alt }) => (
          <li key={slug} className="w-[78%] shrink-0 snap-start sm:w-auto sm:shrink">
            <PhotoSlot
              photo={slug}
              alt={alt}
              label={`Memory · ${caption}`}
              sizes="(max-width: 639px) 78vw, (max-width: 1023px) 30vw, 340px"
              className="aspect-[3/4] w-full rounded-[24px]"
            />
            <p className="mt-3 font-body text-sm text-brand-brown">{caption}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
