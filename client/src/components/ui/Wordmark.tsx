/**
 * The Viannes wordmark, in the two forms the design actually uses.
 *
 * `image` — the full logo lockup, for CREAM SURFACES ONLY (hero, footer body,
 *   empty states). It has a brown outline and a fine "BistrO" line.
 *
 * `text` — a cream text lockup for THE DEEP-RED NAVBAR. The image is not used
 *   there on purpose: the logo's brown outline and thin secondary line go muddy
 *   against #911A1C, so the bar gets set type instead.
 */
interface Props {
  variant: 'image' | 'text';
  className?: string;
  /** Image variant only: rendered width hint for srcset selection. */
  sizes?: string;
  priority?: boolean;
}

export default function Wordmark({
  variant,
  className = '',
  sizes = '260px',
  priority = false,
}: Props) {
  if (variant === 'text') {
    return (
      <span className={`flex flex-col leading-none ${className}`}>
        <span className="font-poster text-2xl lowercase tracking-tight text-brand-cream">
          viannes
        </span>
        <span className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-brand-cream/85">
          Bistro
        </span>
      </span>
    );
  }

  return (
    <picture className={className}>
      <source
        type="image/webp"
        sizes={sizes}
        srcSet="/brand/viannes-logo-240.webp 240w, /brand/viannes-logo-480.webp 480w, /brand/viannes-logo-800.webp 800w, /brand/viannes-logo-1200.webp 1200w"
      />
      <img
        src="/brand/viannes-logo-480.png"
        srcSet="/brand/viannes-logo-240.png 240w, /brand/viannes-logo-480.png 480w, /brand/viannes-logo-800.png 800w, /brand/viannes-logo-1200.png 1200w"
        sizes={sizes}
        alt="Viannes Bistro — a delicious journey"
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        // Height-driven: the picture is a block and fills the column, so a
        // full-width img would letterbox the lockup into the middle of it.
        className="block h-full w-auto object-contain"
      />
    </picture>
  );
}
