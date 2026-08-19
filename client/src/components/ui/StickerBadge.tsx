/**
 * The rotating circular sticker that overlaps a photo corner.
 *
 * Text is set on a circular path with SVG <textPath>, which is the only way to
 * get real curved type that still selects, scales and reads as text. The path
 * is a two-arc circle so the baseline is continuous with no start/end seam.
 *
 * The rotation is decorative: under `prefers-reduced-motion: reduce` the
 * sticker holds perfectly still. It is aria-hidden either way — the words are
 * a garnish on copy that is already stated in the block beside it, and a
 * screen reader reading a rotating ring of text adds nothing.
 */
import { useId } from 'react';
import { usePrefersReducedMotion } from '../../lib/useReducedMotion';

interface Props {
  /** Repeated around the ring. Keep it short — it has one circumference. */
  text?: string;
  /** Centre glyph or short word. */
  centre?: string;
  className?: string;
}

export default function StickerBadge({
  text = 'MADE TO ORDER ✳ MADE TO ORDER ✳ ',
  centre = '✳',
  className = '',
}: Props) {
  const reduced = usePrefersReducedMotion();
  // useId keeps the path id unique when several stickers are on one page —
  // duplicate ids would make every textPath follow the first one's circle.
  const pathId = `sticker-${useId().replace(/:/g, '')}`;

  return (
    <div
      aria-hidden
      /*
       * No `position` of its own. It used to hardcode `relative`, which quietly
       * beat every caller's `absolute`: the two utilities have equal
       * specificity and Tailwind emits `relative` last, so the sticker sat in
       * flow instead of straddling the corner it was positioned onto. The
       * centre mark is stacked with the svg by grid placement instead, which
       * needs no positioning context at all.
       */
      className={`pointer-events-none grid place-items-center rounded-full bg-brand-orange ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className={`col-start-1 row-start-1 h-full w-full ${reduced ? '' : 'animate-spinSlow'}`}
      >
        <defs>
          {/* Two half-arcs = one closed circle, r=37, centred at 50,50. */}
          <path id={pathId} d="M50,13 a37,37 0 1,1 0,74 a37,37 0 1,1 0,-74" fill="none" />
        </defs>
        <text
          className="font-display"
          fill="#1E0E0E"
          fontSize="9.5"
          fontWeight="600"
          letterSpacing="1.1"
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>
      {/* Centre mark sits outside the rotating <svg> so it stays upright. */}
      <span className="col-start-1 row-start-1 font-display text-lg font-semibold text-brand-ink">
        {centre}
      </span>
    </div>
  );
}
