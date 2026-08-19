import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../store/CartContext';

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
 * The entire navigation for a one-page shop: wordmark, one anchor, cart.
 *
 * The shop is one page, so ON THE HOMEPAGE these are scroll controls, not
 * links — the menu is a section of this page and the cart is a drawer over it.
 *
 * OFF the homepage they have to be real links. `scrollTo()` only scrolls the
 * current document and `#menu` does not exist anywhere but `/`, so on
 * /checkout both were silent no-ops and the page was a dead end.
 *
 * Where it navigates it is an <a>, never a button: cmd-click, middle-click,
 * "open in new tab" and the way screen readers announce a link all depend on
 * being a real anchor with an href.
 */
export default function Navbar() {
  const { itemCount, addPulse, openCart } = useCart();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const seenPulse = useRef(addPulse);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A single scale pop on add, so the feedback lands even when the user's eyes
  // are still on the card they just tapped.
  useEffect(() => {
    if (addPulse === seenPulse.current) return;
    seenPulse.current = addPulse;
    const el = badgeRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
      { duration: 250, easing: 'ease-out' }
    );
  }, [addPulse]);

  // Only the homepage puts a dark hero behind the bar. Everywhere else the
  // page starts on cream, so the bar is solid from the top — cream-on-cream
  // text needed a scrim to be legible at all, which looked like a smudge.
  // The homepage is the only route with a hero behind the bar, and the only
  // one where the menu is a section of the current document.
  const isHome = pathname === '/';
  const solid = scrolled || !isHome;
  const onDark = !solid;

  // Extracted so the button and the link render identically — the only
  // difference between the two branches should be the element itself.
  const wordmarkClass = 'flex items-center gap-2';
  const menuClass = `hidden font-body text-sm font-semibold transition-colors duration-150 hover:text-gold sm:inline ${
    onDark ? 'text-cream drop-shadow' : 'text-charcoal'
  }`;
  const wordmark = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brick text-lg">🍔</span>
      <span
        className={`font-poster text-xl uppercase tracking-tight transition-colors duration-150 ${
          onDark ? 'text-cream drop-shadow' : 'text-charcoal'
        }`}
      >
        Besties
      </span>
    </>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-nav transition-colors duration-150 ${
        solid ? 'bg-creamLt/95 shadow-sm backdrop-blur' : 'bg-transparent'
      }`}
    >
      {/* Scrim for the un-scrolled state. The hero crops a photograph into the
          top-right corner, and cream-on-photo left the nav barely readable
          exactly where the pizza sits. Fades out once the bar goes solid. */}
      {onDark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-charcoal/35 to-transparent"
        />
      )}
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        {/* Same markup either way — only the element around it changes. */}
        {isHome ? (
          <button
            type="button"
            onClick={() => scrollTo()}
            className={wordmarkClass}
            aria-label="Besties — back to top"
          >
            {wordmark}
          </button>
        ) : (
          <Link to="/" className={wordmarkClass} aria-label="Besties — back to the shop">
            {wordmark}
          </Link>
        )}

        <div className="flex items-center gap-3 sm:gap-5">
          {isHome ? (
            <button
              type="button"
              onClick={() => scrollTo('menu')}
              className={menuClass}
              aria-label="Scroll to the menu"
            >
              Menu
            </button>
          ) : (
            // Home reads the hash and scrolls once the section has rendered,
            // so this never tries to scroll to an element that isn't there yet.
            <Link to="/#menu" className={menuClass} aria-label="Go to the menu">
              Menu
            </Link>
          )}

          <button
            type="button"
            onClick={openCart}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-brick text-cream shadow-md transition-transform duration-150 hover:scale-105 active:scale-95"
            aria-label={
              itemCount > 0
                ? `Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`
                : 'Open cart'
            }
          >
            🛒
            {itemCount > 0 && (
              <span
                ref={badgeRef}
                className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brick px-1 text-[0.7rem] font-bold tabular-nums text-cream ring-2 ring-creamLt"
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
