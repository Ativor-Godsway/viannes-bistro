import { useEffect, useState } from 'react';

/** True when the user has asked for reduced motion.
 *
 *  Drives the render-level branches — components that must not run their loop
 *  at all (the marquee renders a static line, the sticker badge holds still).
 *  Purely decorative CSS loops are switched off in index.css instead. */
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
