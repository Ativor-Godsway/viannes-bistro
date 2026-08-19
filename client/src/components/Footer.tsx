import { Link } from 'react-router-dom';

/** Smooth-scrolls to the menu section — it is on this page, not on a route. */
function toMenu() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById('menu')
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

export default function Footer() {
  return (
    <footer className="bg-brand-charcoal text-brand-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-red text-lg">🍔</span>
            <span className="font-display text-xl font-extrabold">Besties</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-brand-cream/70">
            Campus fast food, delivered hot across the University of Ghana, Legon.
          </p>
        </div>
        <div>
          <h4 className="font-display font-bold text-brand-gold">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-brand-cream/80">
            {/* The menu is a section of this page, not a route. */}
            <li><button type="button" onClick={toMenu} className="hover:text-brand-gold">Menu</button></li>
            <li><Link to="/track" className="hover:text-brand-gold">Track Order</Link></li>
            <li><Link to="/admin" className="hover:text-brand-gold">Admin Panel</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-bold text-brand-gold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-brand-cream/80">
            <li>📍 University of Ghana, Legon</li>
            <li>📞 0244 123 456</li>
            <li>✉️ hello@besties.com</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-brand-cream/60">
        © {new Date().getFullYear()} Besties Fast Food. Made for campus. 🍕
      </div>
    </footer>
  );
}
