import { useEffect, useState } from 'react';

/** True when the user has asked for reduced motion. Drives the render-level
 *  branches (looping components that shouldn't run at all), not the GSAP ones —
 *  those use gsap.matchMedia(). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
