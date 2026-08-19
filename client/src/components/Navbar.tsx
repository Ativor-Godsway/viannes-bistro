import { useEffect, useRef } from 'react';
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
 * `About` (#about) and `Find us` (#find-us) are gone with the sections that
 * carried those ids — the feature block and the how-it-works strip. A link to
 * an id that is no longer in the document scrolls nowhere and silently does
 * nothing, which is worse than not offering it.
 */
const LINKS = [
  { label: 'Menu', id: 'menu', to: '/#menu' },
  { label: 'Order', id: 'menu', to: '/#menu' },
  { label: 'Memories', id: 'memories', to: '/#memories' },
];

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
      { duration: 250, easing: 'ease-out' }
    );
  }, [addPulse]);

  const isHome = pathname === '/';

  const linkClass =
    'font-display text-xs font-semibold uppercase tracking-wide text-brand-cream/85 transition-colors duration-150 hover:text-brand-cream';

  return (
    <header className="sticky top-0 z-nav bg-brand-redDeep">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
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
          <Link
            to="/"
            className="shrink-0"
            aria-label="Viannes Bistro — back to the shop"
          >
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
            )
          )}
        </div>

        {/* Cart as an outline pill carrying the count, per the reference. */}
        <button
          type="button"
          onClick={openCart}
          className="ml-auto inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-2 border-brand-cream px-4 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream transition-colors duration-150 hover:bg-brand-cream hover:text-brand-redDeep sm:ml-0"
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
    </header>
  );
}
