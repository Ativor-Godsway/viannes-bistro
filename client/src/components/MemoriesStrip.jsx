import PhotoSlot from './ui/PhotoSlot';

/**
 * MEMORIES — a row of photographs from the bistro, and nothing else.
 *
 * It replaced the three-step "how it works" strip, which explained a flow the
 * page already makes obvious and needed three photographs nobody has.
 *
 * Deliberately dumb: the whole section is driven by the array below, so this is
 * seeded with the food photography that exists today and swaps to pictures of
 * people eating there by editing MEMORIES — no JSX changes, no per-photo
 * markup. Add a slug to data/photos.js, add a line here, done.
 *
 * Desktop is a three-up grid. Below `sm` it becomes a horizontal scroller with
 * snap points rather than a stack, because three portrait photos stacked is a
 * screen and a half of scrolling for a decorative strip.
 */
const MEMORIES = [
  { photo: 'club-sandwich', caption: 'Lunch on the bench' },
  { photo: 'smoothies', caption: 'The smoothie line-up' },
  // The cup sits left of centre in this frame, so a centred cover-crop at a
  // wider aspect ratio would slice it. Anchored left instead.
  { photo: 'banana-nutella', caption: 'Banana and chocolate', position: 'object-left' },
];

export default function MemoriesStrip() {
  return (
    <section id="memories" className="bg-brand-cream px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-poster text-[clamp(1.75rem,5vw,3rem)] uppercase leading-tight text-brand-redDeep">
          Memories
        </h2>
        <p className="mt-3 max-w-md font-body text-base text-brand-brown">
          Plates, cups and afternoons at the bench.
        </p>

        {/*
          One element, two behaviours: a snapping flex scroller below `sm`, a
          plain three-column grid from `sm` up. The scroller is padded and
          negatively margined so the first and last cards line up with the page
          gutter while the row still scrolls edge to edge.
        */}
        <ul className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
          {MEMORIES.map(({ photo, caption, position }) => (
            <li key={photo} className="w-[78%] shrink-0 snap-start sm:w-auto sm:shrink">
              <PhotoSlot
                photo={photo}
                label={`Memory · ${caption}`}
                position={position}
                sizes="(max-width: 639px) 78vw, (max-width: 1023px) 30vw, 340px"
                className="aspect-[4/5] w-full rounded-[24px]"
              />
              <p className="mt-3 font-body text-sm text-brand-brown">{caption}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
