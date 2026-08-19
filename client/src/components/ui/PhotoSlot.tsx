/**
 * A photograph slot that cannot break the page.
 *
 * Every editorial photograph in the storefront goes through here. It is given a
 * `photo` SLUG, never a path: the file names, the widths on disk and the alt
 * text all live in data/photos.js, so re-cropping or renaming a shot never
 * touches a component. With no `photo` — or with one that has no derivatives on
 * disk, or one whose file fails to load — it renders a flat creamDeep block
 * carrying the name of the shot that belongs there, which doubles as the brief.
 * A broken-image icon never appears.
 *
 * Responsive by construction: <picture> offers WebP with a JPEG fallback at
 * every width scripts/optimize-images.mjs actually emitted. It cannot advertise
 * a candidate that isn't there, because the widths come from the manifest the
 * pipeline writes.
 *
 * The slot is sized entirely by the caller's className and aspect ratio, so
 * lighting one up changes nothing about layout.
 */
import { useState } from 'react';
import { photoFor, srcSet, srcAt } from '../../data/photos';

interface Props {
  /** A slug from data/photos.js, or undefined while the shot doesn't exist. */
  photo?: string;
  /** Overrides the alt text from the mapping. The placeholder is aria-hidden. */
  alt?: string;
  /** What this slot is for — printed on the placeholder, e.g. "HERO · THE PLATE". */
  label: string;
  /** Tailwind classes for the frame: radius, aspect ratio, sizing. */
  className?: string;
  /** How the photo is cropped inside the frame, e.g. `object-left`. */
  position?: string;
  /** Above-the-fold slots opt out of lazy loading. */
  priority?: boolean;
  sizes?: string;
}

export default function PhotoSlot({
  photo,
  alt,
  label,
  className = '',
  position = 'object-center',
  priority = false,
  sizes,
}: Props) {
  const [failed, setFailed] = useState(false);
  const entry = photo ? photoFor(photo) : null;
  const showPlaceholder = !entry || failed;

  return (
    <div className={`relative overflow-hidden bg-brand-creamDeep ${className}`}>
      {showPlaceholder ? (
        <div aria-hidden className="absolute inset-0 grid place-items-center px-6 text-center">
          <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-brown/70">
            {label}
          </span>
        </div>
      ) : (
        <picture>
          <source type="image/webp" srcSet={srcSet(entry.file, 'webp')} sizes={sizes} />
          <img
            src={srcAt(entry.file, 'jpg')}
            srcSet={srcSet(entry.file, 'jpg')}
            sizes={sizes}
            alt={alt ?? entry.alt}
            decoding="async"
            loading={priority ? 'eager' : 'lazy'}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover ${position}`}
          />
        </picture>
      )}
    </div>
  );
}
