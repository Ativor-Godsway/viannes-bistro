/**
 * Display type that folds down into place, one piece at a time.
 *
 * Used on exactly ONE element on this site — the hero headline. Folding every
 * heading reads as a template; folding the first thing you see reads as craft.
 * If you are about to add a second instance, don't.
 *
 * Differences from the React Bits original, all of which matter here:
 *
 * 1. Its CSS is hoisted into index.css instead of being injected as a <style>
 *    tag from inside the render, which writes a fresh copy per instance.
 * 2. ScrollTrigger is not used AT ALL — see the note below. (The brief asked
 *    for it to be registered once at module level rather than per render; it
 *    turns out the right number of times to register it here is zero.)
 * 3. The play is gated on `document.fonts.ready`. This is the LCP element and
 *    the pieces start at opacity 0, so animating against fallback metrics
 *    would fold the words and then reflow them under the real face. There is a
 *    hard timeout behind it — a font that never resolves must not mean a
 *    headline that never appears.
 * 4. Reduced motion is handled: the pieces are simply present, no timeline.
 *
 * The `sr-only` copy is not decoration. The visible pieces are a pile of
 * inline-blocks with a word each; the sr-only text is what actually holds the
 * headline in the accessibility tree and in the document for no-JS.
 */
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/*
 * ┌─ WHY THERE IS NO ScrollTrigger HERE ─────────────────────────────────────┐
 * │ Registering the plugin — not creating a trigger, merely registering it —  │
 * │ starts a requestAnimationFrame loop of its own (`_rafBugFix`) that runs   │
 * │ for the life of the page. Measured on this page: ~60 rAF callbacks per    │
 * │ second, forever, with zero ScrollTriggers in existence and gsap's own     │
 * │ ticker already asleep. That is a permanent cost for a plugin this site    │
 * │ never asks anything of.                                                   │
 * │                                                                           │
 * │ `trigger="scroll"` is served by an IntersectionObserver instead, which is │
 * │ what the rest of the motion system already uses (see lib/useReveal.ts).   │
 * │ gsap stays, but purely as a tween engine for the one fold.                │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

/** How long to wait for webfonts before playing anyway. */
const FONT_TIMEOUT_MS = 500;

interface Props {
  children: string;
  /**
   * `word` is the right default at display sizes. `char` produces one
   * inline-block per glyph, which at a clamp()-scaled hero headline is a large
   * node count and wraps badly across two lines.
   */
  splitBy?: 'word' | 'char';
  trigger?: 'mount' | 'scroll';
  duration?: number;
  stagger?: number;
  hinge?: 'top' | 'bottom';
  /** The fold's mid-flight colour. Must be legible on the section behind it. */
  color?: string;
  className?: string;
  /** Element to render. The hero passes `h1`. */
  as?: 'h1' | 'h2' | 'p' | 'span';
}

export default function FoldText({
  children,
  splitBy = 'word',
  trigger = 'mount',
  duration = 0.5,
  stagger = 0.05,
  hinge = 'top',
  color = '#911A1C',
  className = '',
  as: Tag = 'span',
}: Props) {
  const ref = useRef<HTMLElement>(null);

  // Lines are preserved: the hero headline is two lines and a single flat list
  // of words would let it re-wrap wherever it liked.
  const lines = children.split('\n').map((line) =>
    splitBy === 'char' ? Array.from(line) : line.split(' ')
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pieces = el.querySelectorAll<HTMLElement>('.fold-text__piece');
    if (!pieces.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The stylesheet already forces these visible; nothing to animate.
      return;
    }

    const origin = hinge === 'top' ? 'top center' : 'bottom center';
    gsap.set(pieces, { opacity: 0, rotateX: hinge === 'top' ? -90 : 90, transformOrigin: origin, color });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tl.to(pieces, {
        opacity: 1,
        rotateX: 0,
        duration,
        stagger,
        ease: 'power3.out',
        // Cleared afterwards so the finished headline is plain text again —
        // a permanent 3D transform keeps it on its own compositor layer and
        // can soften the type on some GPUs.
        clearProps: 'transform,willChange',
        onComplete: () => {
          /*
           * gsap's ticker does NOT stop on its own: importing gsap starts a
           * requestAnimationFrame loop that runs for the life of the page. That
           * is a reasonable default for an app that animates continuously, and
           * completely wrong for this one — we spend a 650ms animation and then
           * burn a frame callback every 16ms forever, on a phone, for nothing.
           *
           * Sleeping is safe: gsap wakes the ticker itself the moment another
           * tween is created.
           */
          gsap.ticker.sleep();
        },
      });

      let played = false;
      const play = () => {
        if (played) return;
        played = true;
        tl.play();
      };

      if (trigger === 'scroll') {
        // The IntersectionObserver equivalent of ScrollTrigger's `once: true`.
        const io = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            io.disconnect();
            play();
          },
          { threshold: 0.15 }
        );
        io.observe(el);
        return () => io.disconnect();
      }

      // Whichever comes first: the fonts settling, or the timeout. The timeout
      // is the one that guarantees the headline appears at all.
      const timer = window.setTimeout(play, FONT_TIMEOUT_MS);
      if (document.fonts) document.fonts.ready.then(play, play);
      else play();
      return () => window.clearTimeout(timer);
    }, el);

    return () => ctx.revert();
  }, [children, splitBy, trigger, duration, stagger, hinge, color]);

  return (
    <Tag ref={ref as never} className={`fold-text ${className}`}>
      <span className="sr-only">{children.replace(/\n/g, ' ')}</span>
      <span aria-hidden className="fold-text__pieces">
        {lines.map((pieces, l) => (
          <span key={l} className="block">
            {pieces.map((piece, i) => (
              <span key={i} className="fold-text__piece">
                {piece}
                {splitBy === 'word' && i < pieces.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        ))}
      </span>
    </Tag>
  );
}
