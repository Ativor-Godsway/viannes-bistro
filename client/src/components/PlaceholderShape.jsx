import { useId, useRef } from 'react';

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
 *  - palette: 'cream' | 'red' | 'ink' | 'orange'
 *  - size:    CSS length applied to width+height (optional; className can win)
 *  - speed:   seconds per idle cycle — higher is slower/calmer
 *  - seed:    de-syncs instances so nothing pulses in unison
 */

// Kept in step with the brand scale in tailwind.config.js. These are raw hexes
// because they are painted into SVG fills, not applied as classes.
const PALETTES = {
  cream: { a: '#F4F3DC', b: '#E0DEB8' },
  red: { a: '#E3231B', b: '#911A1C' },
  ink: { a: '#3A2418', b: '#1E0E0E' },
  orange: { a: '#F86F0F', b: '#E3231B' },
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

  // Idle motion is CSS keyframes (see index.css), not a JS tween: this is
  // scaffolding that disappears once real photography lands, and it was the
  // last thing in the app pulling in gsap.
  //
  // `idle={false}` opts out — used when an ancestor already animates the shape.
  // Reduced motion is handled in the stylesheet, where the keyframes are
  // switched off entirely rather than merely shortened.
  const delay = `${((seed % 7) * 0.55).toFixed(2)}s`;
  const animate = idle
    ? variant === 'ring' || variant === 'disc'
      ? 'ph-spin'
      : 'ph-float'
    : '';

  const boxStyle = { ...(size ? { width: size, height: size } : null), ...style };
  const fill = `url(#pg-${gid})`;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none relative ${animate} ${className}`}
      style={{
        ...boxStyle,
        '--ph-dur': `${variant === 'ring' ? speed * 2.4 : variant === 'disc' ? speed * 3 : speed / 2}s`,
        '--ph-delay': delay,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={variant === 'disc' || variant === 'ring' ? 'xMidYMid meet' : 'none'}
        className={`absolute inset-0 h-full w-full overflow-visible ${
          idle && variant === 'disc' ? 'ph-pulse' : ''
        }`}
        style={{ '--ph-dur': `${speed / 2}s`, '--ph-delay': delay }}
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
