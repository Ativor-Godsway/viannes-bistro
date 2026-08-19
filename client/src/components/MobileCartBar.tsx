import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../store/CartContext';
import { GHS } from '../lib/format';

/**
 * The sticky mobile order bar.
 *
 * Appears only once there is something in the cart, and is the reason this shop
 * needs no cart page at all: the running total is always visible and checkout
 * is always one tap away, without ever interrupting browsing.
 *
 * Hidden on `sm` and up, where the header's cart button is already in view, and
 * hidden while the drawer is open so it isn't stacked behind its own contents.
 */
export default function MobileCartBar() {
  const { itemCount, subtotal, openCart, isOpen } = useCart();
  const barRef = useRef<HTMLDivElement>(null);
  const show = itemCount > 0 && !isOpen;

  /**
   * Publishes this bar's height as --mobile-cart-bar-h so other bottom-anchored
   * UI (the post-add confirmation) can sit clear of it instead of guessing.
   *
   * Measured rather than hardcoded, and `sm:hidden` means offsetHeight is 0 on
   * desktop, so the variable is self-correcting across breakpoints.
   */
  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!show || !el) {
      root.style.setProperty('--mobile-cart-bar-h', '0px');
      return;
    }
    const measure = () =>
      root.style.setProperty('--mobile-cart-bar-h', `${el.offsetHeight}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      root.style.setProperty('--mobile-cart-bar-h', '0px');
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={barRef}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 z-cart-bar border-t border-brand-brown/10 bg-brand-cream/95 px-4 pt-3 backdrop-blur sm:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={openCart}
            className="flex h-12 w-full items-center justify-between rounded-full bg-brand-red px-5 text-brand-cream transition-transform duration-150 active:scale-[0.98]"
          >
            <span className="grid h-7 min-w-[1.75rem] place-items-center rounded-full bg-brand-cream/20 px-2 font-body text-xs font-bold tabular-nums">
              {itemCount}
            </span>
            <span className="font-display text-xs font-semibold uppercase tracking-wide">
              View cart
            </span>
            <span className="font-body text-sm font-bold tabular-nums">{GHS(subtotal)}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
