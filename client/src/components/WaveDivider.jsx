import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { BEAT4 } from '../lib/choreo';

/**
 * BEAT 4 — the threshold.
 * The seam between the two rooms. The curve morphs from deep to shallow as it
 * crosses the viewport, so the boundary feels like a soft physical edge rather
 * than a section break. Path morphing is one of the two sanctioned exceptions
 * to the transform/opacity-only rule.
 */
export default function WaveDivider({ fill = '#C2261C', className = '' }) {
  const pathRef = useRef(null);

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: reduce)', () => {
      el.setAttribute('d', BEAT4.shallow);
    });
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Both paths share an identical command signature, so a straight numeric
      // interpolation of the control points is safe without MorphSVG.
      const nums = (d) => d.match(/-?\d+\.?\d*/g).map(Number);
      const from = nums(BEAT4.deep);
      const to = nums(BEAT4.shallow);
      const template = BEAT4.deep.split(/-?\d+\.?\d*/);
      const proxy = { v: [...from] };

      gsap.to(proxy.v, {
        endArray: to,
        ease: 'none',
        onUpdate: () => {
          let d = '';
          template.forEach((chunk, i) => {
            d += chunk + (i < proxy.v.length ? Math.round(proxy.v[i] * 100) / 100 : '');
          });
          el.setAttribute('d', d);
        },
        scrollTrigger: {
          trigger: el.closest('svg'),
          start: 'bottom bottom',
          end: 'top top',
          scrub: BEAT4.scrub,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden
      className={`block h-[9vh] w-full ${className}`}
    >
      <path ref={pathRef} d={BEAT4.deep} fill={fill} />
    </svg>
  );
}
