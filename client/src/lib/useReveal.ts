/**
 * The whole scroll-animation budget for this site, in one hook.
 *
 * An IntersectionObserver plus a CSS transition — deliberately not gsap or
 * ScrollTrigger. Those are already loaded for exactly one thing (the hero
 * headline), and putting scroll-linked work through them for every section
 * means a scroll handler competing with the browser's own compositing for
 * effects a `transition` does on the compositor for free.
 *
 * Fires ONCE at 15% visibility and then disconnects. There is no exit
 * animation and no re-trigger: content that fades out again as you scroll back
 * up is a toy, and it makes re-finding something you just read unpleasant.
 *
 * The hidden state is applied here rather than in the stylesheet's default, so
 * that a page whose JS never runs shows its content instead of a blank column.
 * See the `[data-reveal]` rules in index.css.
 */
import { useLayoutEffect, useRef } from 'react';

const VISIBILITY = 0.15;

export function useReveal<T extends HTMLElement>(delayMs = 0) {
  const ref = useRef<T>(null);

  // Layout effect, not effect: the hidden state has to be on the element before
  // the browser paints, or the content flashes in at full opacity first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Both of these mean "show it, don't animate it". Checked here rather than
    // relying on the stylesheet alone so we also skip creating the observer.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      el.dataset.reveal = 'shown';
      return;
    }

    el.style.setProperty('--reveal-delay', `${delayMs}ms`);
    el.dataset.reveal = 'hidden';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.reveal = 'shown';
        // Once only. Disconnecting here rather than in cleanup means the
        // observer stops costing anything the moment it has done its job.
        observer.disconnect();
        // will-change is a promise to the compositor, not a decoration — it is
        // dropped once the transition it was for has finished.
        el.addEventListener(
          'transitionend',
          () => {
            el.style.willChange = '';
          },
          { once: true }
        );
      },
      { threshold: VISIBILITY }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [delayMs]);

  return ref;
}
