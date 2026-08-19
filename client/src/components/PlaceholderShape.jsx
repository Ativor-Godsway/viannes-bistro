import { useEffect, useId, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Animated stand-in for a food photograph. Zero raster assets.
 *
 * The wrapper occupies *exactly* the box a real <img> will occupy — the caller
 * sizes it via `className`/`size` and the artwork fills `absolute inset-0`.
 * Swapping in real photography later is a one-line change: return
 *   <img src={src} className="absolute inset-0 h-full w-full object-cover" />
 * from inside this component (or swap the component wholesale). No layout work.
 *
 * Props
 *  - variant: 'disc' | 'blob' | 'arch' | 'squircle' | 'ring'
 *  - palette: 'cream' | 'red' | 'charcoal' | 'gold'
 *  - size:    CSS length applied to width+height (optional; className can win)
 *  - speed:   seconds per idle cycle — higher is slower/calmer
 *  - seed:    de-syncs instances so nothing pulses in unison
 */

const PALETTES = {
  cream: { a: '#F7EFE2', b: '#EBD9BC' },
  red: { a: '#C2261C', b: '#9E1B13' },
  charcoal: { a: '#2A2724', b: '#1A1A1A' },
  gold: { a: '#E0A72C', b: '#C2261C' },
};

// Cubic circle-approximation constant. Blob morphing tweens four radii, which
// guarantees a structurally identical `d` at every keyframe (no morph plugin,
// no chance of an invalid interpolation).
const K = 0.5523;

/** radii = [top, right, bottom, left], drawn around centre 50,50 of a 100x100 box. */
function blobPath([t, r, b, l]) {
  const n = (v) => Math.round(v * 100) / 100;
  return [
    `M ${n(50)} ${n(50 - t)}`,
    `C ${n(50 + r * K)} ${n(50 - t)} ${n(50 + r)} ${n(50 - t * K)} ${n(50 + r)} ${n(50)}`,
    `C ${n(50 + r)} ${n(50 + b * K)} ${n(50 + r * K)} ${n(50 + b)} ${n(50)} ${n(50 + b)}`,
    `C ${n(50 - l * K)} ${n(50 + b)} ${n(50 - l)} ${n(50 + b * K)} ${n(50 - l)} ${n(50)}`,
    `C ${n(50 - l)} ${n(50 - t * K)} ${n(50 - l * K)} ${n(50 - t)} ${n(50)} ${n(50 - t)}`,
    'Z',
  ].join(' ');
}

// Three organic states the blob loops between.
const BLOB_STATES = [
  [41, 45, 38, 43],
  [45, 38, 46, 36],
  [37, 46, 42, 47],
];

export default function PlaceholderShape({
  variant = 'blob',
  palette = 'red',
  size,
  className = '',
  speed = 10,
  seed = 0,
  style,
  idle = true,
}) {
  const rootRef = useRef(null);
  const pathRef = useRef(null);
  const gid = useId().replace(/:/g, '');
  const { a, b } = PALETTES[palette] || PALETTES.red;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Reduced motion: shapes hold a single static state, no idle loop at all.
    // `idle={false}` opts out too — used when an ancestor already animates the
    // shape (the hero, where the photo and its fallback spin as one object).
    if (!idle || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const delay = (seed % 7) * 0.55; // de-sync instances
    const ctx = gsap.context(() => {
      // Idle motion is transform-only, and always running — the page must never
      // look frozen when the user stops scrolling.
      if (variant === 'ring') {
        gsap.to(root, { rotation: 360, duration: speed * 2.4, repeat: -1, ease: 'none', delay });
      } else if (variant === 'disc') {
        gsap.to(root, { rotation: 360, duration: speed * 3, repeat: -1, ease: 'none', delay });
        gsap.to(root, {
          scale: 1.02,
          duration: speed / 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay,
        });
      } else {
        gsap.to(root, {
          y: -8,
          rotation: variant === 'blob' ? 4 : 2,
          scale: 1.02,
          duration: speed / 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay,
        });
      }

      // Blob: genuine SVG path morph between organic states on a slow loop.
      if (variant === 'blob' && pathRef.current) {
        const el = pathRef.current;
        const proxy = { r: [...BLOB_STATES[0]] };
        const tl = gsap.timeline({ repeat: -1, delay });
        BLOB_STATES.slice(1)
          .concat([BLOB_STATES[0]])
          .forEach((target) => {
            tl.to(proxy.r, {
              endArray: target,
              duration: speed / 3,
              ease: 'sine.inOut',
              onUpdate: () => el.setAttribute('d', blobPath(proxy.r)),
            });
          });
      }
    }, rootRef);

    return () => ctx.revert();
  }, [variant, speed, seed, idle]);

  const boxStyle = { ...(size ? { width: size, height: size } : null), ...style };
  const fill = `url(#pg-${gid})`;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none relative ${className}`}
      style={boxStyle}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={variant === 'disc' || variant === 'ring' ? 'xMidYMid meet' : 'none'}
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`pg-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>

        {variant === 'disc' && <circle cx="50" cy="50" r="50" fill={fill} />}

        {variant === 'ring' && (
          <circle cx="50" cy="50" r="43" fill="none" stroke={fill} strokeWidth="8" />
        )}

        {variant === 'blob' && <path ref={pathRef} d={blobPath(BLOB_STATES[0])} fill={fill} />}

        {variant === 'arch' && <path d="M0 100 V50 A50 50 0 0 1 100 50 V100 Z" fill={fill} />}

        {variant === 'squircle' && (
          <rect x="0" y="0" width="100" height="100" rx="26" ry="26" fill={fill} />
        )}
      </svg>
    </div>
  );
}
