/**
 * The full-bleed scrolling ticker band.
 *
 * The track is rendered TWICE and translated by exactly -50%, so the second
 * copy lands precisely where the first started and the loop has no seam. Both
 * copies are aria-hidden and the phrase is exposed once to assistive tech as
 * static text — a screen reader should hear it one time, not on a loop.
 *
 * Under `prefers-reduced-motion: reduce` this collapses to a single static
 * line: the animation is removed entirely rather than merely slowed, and the
 * duplicate track is not rendered at all.
 */
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';

interface Props {
  /** The phrase, without separators — they are inserted between repeats. */
  phrase?: string;
  /** How many times the phrase appears in one track. */
  repeat?: number;
  className?: string;
}

const SEPARATOR = '✳';

export default function Marquee({
  phrase = 'VIANNES BISTRO ✳ A DELICIOUS JOURNEY ✳ EAT IN UNDER THE TREES',
  repeat = 4,
  className = '',
}: Props) {
  const reduced = usePrefersReducedMotion();

  const item = (
    <span className="mx-6 font-display text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-brand-cream sm:text-sm">
      {phrase}
      <span aria-hidden className="ml-6 text-brand-orange">
        {SEPARATOR}
      </span>
    </span>
  );

  if (reduced) {
    // Static single line, centred, no overflow and no animation.
    return (
      <div className={`w-full overflow-hidden bg-brand-redDeep py-2.5 ${className}`}>
        <p className="truncate px-5 text-center font-display text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-brand-cream sm:text-sm">
          {phrase}
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden bg-brand-redDeep py-2.5 ${className}`}>
      {/* Announced once. The moving copies below are decorative. */}
      <p className="sr-only">{phrase}</p>
      <div className="flex w-max animate-marquee will-change-transform" aria-hidden>
        {/* Two identical tracks. -50% of the flex container = exactly one track. */}
        {[0, 1].map((track) => (
          <div key={track} className="flex shrink-0 items-center">
            {Array.from({ length: repeat }, (_, i) => (
              <span key={i} className="flex items-center">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
