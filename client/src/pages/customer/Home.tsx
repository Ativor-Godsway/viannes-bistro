import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../../components/Hero';
import StatementBand from '../../components/StatementBand';
import MemoriesSection from '../../components/MemoriesSection';
import MenuSection from '../../components/MenuSection';
import Marquee from '../../components/ui/Marquee';

/**
 * The shop. One continuous scroll, alternating cream fields and deep-red bands.
 *
 * Everything else in the ordering flow happens over this page: tapping a card
 * opens the configurator as a modal, adding opens nothing, and the cart is a
 * drawer. The only route change between landing here and paying is /checkout.
 *
 * The top marquee sits ABOVE the navbar in the document, so it scrolls away
 * while the bar stays stuck to the top — see CustomerLayout.
 *
 * The JOLLOF feature block is gone: it sold one arbitrary item from the
 * inherited placeholder catalogue and carried an invented five-star rating.
 * The three-step "how it works" strip is gone too, replaced by MEMORIES, which
 * is deliberately LAST: CustomerLayout renders the footer immediately after
 * <main>, so the memories band and the footer meet directly.
 */
export default function Home() {
  const { hash } = useLocation();

  // `/menu` redirects to `/#menu`, and the header's links use the same anchors.
  // Deferred a frame so the section exists before we scroll to it.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    );
    return () => cancelAnimationFrame(raf);
  }, [hash]);

  return (
    <div className="bg-brand-cream">
      <Hero />
      <StatementBand />
      <Marquee />
      <MenuSection />
      <MemoriesSection />
    </div>
  );
}
