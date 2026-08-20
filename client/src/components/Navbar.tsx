import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../store/CartContext';
import Wordmark from './ui/Wordmark';

/** Smooth-scrolls to an element, or to the top when no id is given. */
function scrollTo(id?: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  if (!id) {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
}

/**
 * The deep-red navigation band.
 *
 * The shop is still ONE PAGE, and this bar has not been converted to routes.
 * On the homepage the links are scroll controls; off it they are real links
 * back to `/#menu`, because `scrollTo()` only scrolls the current document and
 * `#menu` exists nowhere but `/` — which is how /checkout became a dead end
 * once before.
 *
 * Where it navigates it is an <a>, never a button: cmd-click, middle-click,
 * "open in new tab" and the way screen readers announce a link all depend on
 * being a real anchor with an href.
 *
 * The bar is solid deep red at every scroll position, so unlike the old build
 * there is no transparent state, no scrim and no scroll listener.
 */

/**
 * The section anchors. `to` is the off-homepage fallback.
 *
 * `Find us` is deliberately NOT in this list — it is rendered separately, as an
 * outline pill beside the cart. Viannes is a garden bistro that also delivers,
 * so where it is is a destination rather than a footnote, and a fourth
 * identical text link is not how you say that. It points at the footer's
 * contact block, which is the only place on the site that answers the question.
 */
const LINKS = [
  { label: 'Menu', id: 'menu', to: '/#menu' },
  { label: 'Order', id: 'menu', to: '/#menu' },
  { label: 'Memories', id: 'memories', to: '/#memories' },
];

/** How far you must scroll before the bar tightens. */
const CONDENSE_AT = 40;

export default function Navbar() {
  const { itemCount, addPulse, openCart } = useCart();
  const { pathname } = useLocation();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const seenPulse = useRef(addPulse);

  // A single scale pop on add, so the feedback lands even when the user's eyes
  // are still on the card they just tapped.
  useEffect(() => {
    if (addPulse === seenPulse.current) return;
    seenPulse.current = addPulse;
    const el = badgeRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: 250, easing: 'ease-out' },
    );
  }, [addPulse]);

  // Condensed state. Read from a passive scroll listener and written only when
  // the boolean actually flips, so a scroll is one comparison per frame rather
  // than a React render per frame.
  const [condensed, setCondensed] = useState(false);
  const condensedRef = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > CONDENSE_AT;
      if (next === condensedRef.current) return;
      condensedRef.current = next;
      setCondensed(next);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHome = pathname === '/';

  const linkClass =
    'font-display text-xs font-semibold uppercase tracking-wide text-brand-cream/85 transition-colors duration-150 hover:text-brand-cream';

  return (
    /*
     * ┌─ WHY THE BAR IS A CHILD AND THE HEADER IS A FIXED-HEIGHT SHELL ───────┐
     * │ The bar tightens by 10px once you scroll. A sticky element is still   │
     * │ IN FLOW, so animating the <header>'s own height would shorten the     │
     * │ document and slide every pixel below it up by 10 — a scroll-linked    │
     * │ reflow, and a visible jump, which is the one thing the motion rules   │
     * │ forbid. The shell keeps a constant 68px slot so the flow never        │
     * │ changes; only the painted bar inside it resizes.                      │
     * │                                                                       │
     * │ The shell is pointer-events-none so the strip it leaves uncovered     │
     * │ when condensed doesn't swallow clicks meant for the page underneath.  │
     * └───────────────────────────────────────────────────────────────────────┘
     */
    <header className="pointer-events-none sticky top-0 z-nav h-[68px]">
      <div
        className={`pointer-events-auto absolute inset-x-0 top-0 bg-brand-redDeep transition-[height,box-shadow] duration-200 ease-out ${
          // An inset shadow, not a border: a border would add to the box height
          // and undo the whole point of the shell above.
          condensed ? 'h-[58px] shadow-[inset_0_-1px_0_#6E1214]' : 'h-[68px]'
        }`}
      >
        <nav className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-5">
          {isHome ? (
            <button
              type="button"
              onClick={() => scrollTo()}
              className="shrink-0 text-left"
              aria-label="Viannes Bistro — back to top"
            >
              <Wordmark variant="text" />
            </button>
          ) : (
            <Link to="/" className="shrink-0" aria-label="Viannes Bistro — back to the shop">
              <Wordmark variant="text" />
            </Link>
          )}

          {/* Centre-right cluster. Hidden on the narrowest screens, where the
            cart pill and the wordmark are the only things that fit. */}
          <div className="ml-auto hidden items-center gap-6 sm:flex">
            {LINKS.map((link) =>
              isHome ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => scrollTo(link.id)}
                  className={linkClass}
                >
                  {link.label}
                </button>
              ) : (
                <Link key={link.label} to={link.to} className={linkClass}>
                  {link.label}
                </Link>
              ),
            )}
          </div>

          {/*
          FIND US. A pill rather than a fourth text link: the bistro is a place
          you sit in first and a delivery kitchen second, and the nav should
          read that way. It targets the footer's contact block, which is where
          the address and hours actually live.
        */}
          {isHome ? (
            <button
              type="button"
              onClick={() => scrollTo('find-us')}
              className={`press ml-auto hidden min-h-[40px] shrink-0 items-center rounded-full border-2 border-brand-cream/70 px-4 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream transition-colors duration-150 hover:border-brand-cream hover:bg-brand-cream hover:text-brand-redDeep sm:inline-flex sm:ml-0`}
            >
              Find us
            </button>
          ) : (
            <Link
              to="/#find-us"
              className="press ml-auto hidden min-h-[40px] shrink-0 items-center rounded-full border-2 border-brand-cream/70 px-4 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream transition-colors duration-150 hover:border-brand-cream hover:bg-brand-cream hover:text-brand-redDeep sm:inline-flex sm:ml-0"
            >
              Find us
            </Link>
          )}

          {/* Cart as an outline pill carrying the count, per the reference. */}
          <button
            type="button"
            onClick={openCart}
            className="press ml-auto inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-2 border-brand-cream px-4 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream transition-colors duration-150 hover:bg-brand-cream hover:text-brand-redDeep sm:ml-0"
            aria-label={
              itemCount > 0
                ? `Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`
                : 'Open cart'
            }
          >
            <span>Cart</span>
            {/* No "0" badge on an empty cart — it reads as a real count. */}
            {itemCount > 0 && (
              <span
                ref={badgeRef}
                className="grid h-6 min-w-[1.5rem] place-items-center rounded-full bg-brand-orange px-1.5 text-[0.7rem] font-bold tabular-nums text-brand-ink"
              >
                {itemCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
