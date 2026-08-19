import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../../components/Hero';
import MenuSection from '../../components/MenuSection';

/**
 * The shop. Hero, then the menu, then the footer — one continuous scroll.
 *
 * Everything else in the ordering flow happens over this page: tapping a card
 * opens the configurator as a modal, adding opens nothing, and the cart is a
 * drawer. The only route change between landing here and paying is /checkout.
 */
export default function Home() {
  const { hash } = useLocation();

  // `/menu` redirects to `/#menu`, and the header's Menu link uses the same
  // anchor. Deferred a frame so the section exists before we scroll to it.
  useEffect(() => {
    if (hash !== '#menu') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = requestAnimationFrame(() =>
      document
        .getElementById('menu')
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    );
    return () => cancelAnimationFrame(id);
  }, [hash]);

  return (
    <div className="bg-brick">
      <Hero />
      <MenuSection />
    </div>
  );
}
