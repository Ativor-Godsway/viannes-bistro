import PillTag from './ui/PillTag';
import Reveal from './ui/Reveal';

/**
 * Full-bleed deep-red band carrying one line of large display copy.
 *
 * Cream on redDeep measures 8.0:1, so the type is legible at any size here.
 * The corner tags are decorative punctuation — they float at the corners on
 * desktop and reflow into a plain row on narrow screens, where absolute
 * positioning would put them on top of the headline.
 */
const TAGS = ['Sandwiches', 'Smoothies', 'Sides', 'Hot plates'];

export default function StatementBand() {
  return (
    <section className="relative overflow-hidden bg-brand-redDeep px-5 py-20 sm:px-8 sm:py-28">
      {/* Floating corner tags — desktop only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <PillTag tone="onDark" className="absolute left-10 top-12">
          {TAGS[0]}
        </PillTag>
        <PillTag tone="onDark" className="absolute right-12 top-20">
          {TAGS[1]}
        </PillTag>
        <PillTag tone="onDark" className="absolute bottom-16 left-20">
          {TAGS[2]}
        </PillTag>
        <PillTag tone="onDark" className="absolute bottom-12 right-16">
          {TAGS[3]}
        </PillTag>
      </div>

      <Reveal>
        <p className="mx-auto max-w-4xl text-center font-poster text-[clamp(1.75rem,5.5vw,4rem)] uppercase leading-[1.05] text-brand-cream">
          Some afternoons deserve a longer lunch.
        </p>
      </Reveal>

      {/* The same tags, in flow, wherever the floating set is hidden. */}
      <div className="mt-10 flex flex-wrap justify-center gap-2.5 lg:hidden">
        {TAGS.map((tag) => (
          <PillTag key={tag} tone="onDark">
            {tag}
          </PillTag>
        ))}
      </div>
    </section>
  );
}
