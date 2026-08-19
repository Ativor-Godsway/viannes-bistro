import { useEffect, useRef, useState } from 'react';
import PlaceholderShape from './PlaceholderShape';
import { srcSet, srcAt, slotWidths } from '../data/menuImages';

/**
 * A product photograph in the exact box a PlaceholderShape used to occupy.
 *
 * The wrapper is sized entirely by the caller's `className` — identical to the
 * shape it replaces — so swapping one for the other changes nothing about
 * layout. The shape stays rendered underneath as the pre-decode state and as
 * the permanent fallback if the image fails or is blocked; it cross-fades out
 * only once the photo has actually decoded.
 *
 * Cut-outs sit directly on the field: object-contain, no card, no shadow.
 */
export default function FoodImage({
  file,
  alt,
  priority = false,
  sizes,
  className = '',
  fallbackVariant = 'disc',
  fallbackPalette = 'gold',
  fallbackIdle = true,
  seed = 0,
  onReady,
  imgRef,
}) {
  const localRef = useRef(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'failed'

  const widths = slotWidths(file, priority);
  const fallbackWidth = widths[widths.length - 1];

  useEffect(() => {
    const img = localRef.current;
    if (!img) return;
    let alive = true;

    const settle = (next) => {
      if (!alive) return;
      setState(next);
      if (next === 'ready') onReady?.(img);
    };

    // decode() resolves once the bitmap is ready to paint, which is the moment
    // the cross-fade should start — `complete` alone can still cause a flash.
    if (img.complete && img.naturalWidth > 0) {
      img.decode().then(
        () => settle('ready'),
        () => settle('ready') // decode can reject on some formats; the image is still usable
      );
    } else {
      img.addEventListener('load', () => settle('ready'), { once: true });
      img.addEventListener('error', () => settle('failed'), { once: true });
    }

    return () => {
      alive = false;
    };
  }, [file, onReady]);

  return (
    <div className={`relative ${className}`}>
      {/* Pre-decode / image-blocked state. Never unmounted — it is the fallback. */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: state === 'ready' ? 0 : state === 'failed' ? 1 : 0.55 }}
      >
        <PlaceholderShape
          variant={fallbackVariant}
          palette={fallbackPalette}
          idle={fallbackIdle}
          seed={seed}
          speed={20}
          className="h-full w-full"
        />
      </div>

      <picture>
        <source type="image/webp" srcSet={srcSet(file, widths, 'webp')} sizes={sizes} />
        <img
          ref={(el) => {
            localRef.current = el;
            if (imgRef) imgRef.current = el;
            // Set imperatively: React 18 doesn't recognise the camelCase prop
            // and warns about the lowercase one.
            if (el && priority) el.setAttribute('fetchpriority', 'high');
          }}
          src={srcAt(file, fallbackWidth, 'png')}
          srcSet={srcSet(file, widths, 'png')}
          sizes={sizes}
          alt={alt}
          width={fallbackWidth}
          height={fallbackWidth}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
          style={{ opacity: state === 'ready' ? 1 : 0 }}
        />
      </picture>
    </div>
  );
}
