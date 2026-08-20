import { Link } from 'react-router-dom';
import Reveal from './ui/Reveal';

/** Smooth-scrolls to the menu section — it is on this page, not on a route. */
function toMenu() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById('menu')
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Deep-red footer, closed by a giant wordmark that bleeds off both edges.
 *
 * The wordmark is set as type rather than as the logo image: it has to run
 * edge to edge at any viewport width, and it sits on red, where the logo's
 * brown outline goes muddy. It is aria-hidden — the business name is already
 * announced by the contact block above it, and a screen reader does not need
 * to hear a clipped decorative repeat of it.
 */
export default function Footer() {
  return (
    <footer className="overflow-hidden bg-brand-redDeep text-brand-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-8">
        <Reveal index={0}>
          <p className="font-poster text-xl lowercase text-brand-cream">viannes</p>
          <p className="font-display text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-brand-cream/85">
            Bistro
          </p>
          <p className="mt-4 max-w-xs font-body text-sm text-brand-cream/75">
            A garden bistro at the University of Ghana, Legon. Eat in or order ahead.
          </p>
        </Reveal>

        <Reveal index={1}>
          <h4 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-cream">
            Explore
          </h4>
          <ul className="mt-4 space-y-2.5 font-body text-sm text-brand-cream/80">
            {/* The menu is a section of this page, not a route. */}
            <li>
              <button
                type="button"
                onClick={toMenu}
                className="transition-colors duration-150 hover:text-brand-cream"
              >
                Menu
              </button>
            </li>
            <li>
              <Link to="/track" className="transition-colors duration-150 hover:text-brand-cream">
                Track Order
              </Link>
            </li>
            <li>
              <Link to="/admin" className="transition-colors duration-150 hover:text-brand-cream">
                Admin Panel
              </Link>
            </li>
          </ul>
        </Reveal>

        {/* The nav's FIND US pill scrolls here — this block is the only place
            on the site that answers where the bistro actually is. */}
        <Reveal index={2}>
          <h4
            id="find-us"
            className="scroll-mt-24 font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-cream"
          >
            Find us
          </h4>
          <ul className="mt-4 space-y-2.5 font-body text-sm text-brand-cream/80">
            {/* TODO(viannes): real street address. */}
            <li>University of Ghana, Legon</li>
            {/* TODO(viannes): real phone number. */}
            <li>Phone — to be confirmed</li>
            {/* TODO(viannes): real email address. */}
            <li>Email — to be confirmed</li>
            {/* TODO(viannes): real opening hours. The copy now says "all day",
                so this is the contact line customers will actually look for. */}
            <li>Hours — to be confirmed</li>
            {/* TODO(viannes): real social handle, and make it a link once known. */}
            <li>Social — to be confirmed</li>
          </ul>
        </Reveal>
      </div>

      <p className="border-t border-brand-cream/15 py-4 text-center font-body text-xs text-brand-cream/60">
        © {new Date().getFullYear()} Viannes Bistro. A delicious journey.
      </p>

      {/* Giant wordmark, clipped by the footer's overflow-hidden. */}
      <p
        aria-hidden
        className="select-none whitespace-nowrap text-center font-poster text-[19vw] uppercase leading-[0.8] tracking-tight text-brand-cream/15"
      >
        Viannes Bistro
      </p>
    </footer>
  );
}
