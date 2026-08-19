import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../store/CartContext';
import { useConfigurator } from '../store/ConfiguratorContext';
import { useCatalogue } from '../lib/useCatalogue';
import { GHS } from '../lib/format';
import { DELIVERY_FEE } from '../lib/fees';
import CartLineRow from './CartLineRow';
import CartNotices from './CartNotices';
import { lockScroll, unlockScroll } from '../lib/scrollLock';

/**
 * Cart drawer — right-hand panel on desktop, bottom sheet on mobile.
 *
 * Closes on backdrop click, Escape, and (on the sheet) a downward drag.
 * Focus is trapped while open and restored to whatever opened it.
 */
export default function CartDrawer() {
  const {
    isOpen,
    closeCart,
    lines,
    subtotal,
    itemCount,
    setQuantity,
    removeItem,
    priceNotices,
    issues,
    dismissNotices,
  } = useCart();
  const { edit } = useConfigurator();
  const { items: menu } = useCatalogue();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  // Escape to close, focus trapped inside the panel, focus restored on close.
  useEffect(() => {
    if (!isOpen) return;
    restoreTo.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // Reference-counted, so opening the drawer over the configurator and
    // closing one of them does not unpin the page under the other.
    lockScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      restoreTo.current?.focus?.();
    };
  }, [isOpen, closeCart]);

  // The menu is a section of this page, so "browse" is a scroll, not a route.
  const browseMenu = () => {
    closeCart();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      document
        .getElementById('menu')
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    );
  };

  const menuById = useMemo(() => new Map(menu.map((m) => [m._id, m])), [menu]);

  const deliveryFee = lines.length ? DELIVERY_FEE : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-drawer" role="presentation">
          <motion.div
            className="absolute inset-0 bg-charcoal/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-creamLt sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(26rem,100vw)] sm:rounded-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) closeCart();
            }}
          >
            {/* Sheet grab handle, mobile only. */}
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-charcoal/20 sm:hidden" />

            <header className="flex items-center justify-between px-5 pb-3 pt-4">
              <h2 className="font-poster text-2xl uppercase text-charcoal">
                Cart{itemCount > 0 && <span className="text-brick"> ({itemCount})</span>}
              </h2>
              <button
                type="button"
                onClick={closeCart}
                data-autofocus
                className="grid h-11 w-11 place-items-center rounded-full text-2xl text-charcoal transition-transform duration-150 active:scale-95"
                aria-label="Close cart"
              >
                ×
              </button>
            </header>

            <CartNotices
              priceNotices={priceNotices}
              issues={issues}
              onDismiss={dismissNotices}
              className="mx-5 mb-2"
            />

            <div className="flex-1 overflow-y-auto px-5">
              {lines.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-body text-sm text-charcoal/70">Your cart is empty.</p>
                  <button
                    type="button"
                    onClick={browseMenu}
                    className="mt-4 inline-flex h-11 items-center rounded-full bg-brick px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-transform duration-150 active:scale-95"
                  >
                    Browse menu
                  </button>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-charcoal/10">
                    {lines.map((line) => {
                      const item = menuById.get(line.productId);
                      return (
                        <CartLineRow
                          key={line.key}
                          line={line}
                          onEdit={item ? () => edit(line, item) : undefined}
                          onQuantity={(q) => setQuantity(line.key, q)}
                          onRemove={() => removeItem(line.key)}
                        />
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {lines.length > 0 && (
              // Pinned footer, clear of the mobile browser chrome.
              <footer
                className="border-t border-charcoal/10 bg-cream px-5 pt-4"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              >
                <dl className="space-y-1 font-body text-sm text-charcoal">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd className="tabular-nums">{GHS(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Delivery</dt>
                    <dd className="tabular-nums">{GHS(deliveryFee)}</dd>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-extrabold">
                    <dt>Total</dt>
                    <dd className="tabular-nums text-brick">{GHS(subtotal + deliveryFee)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    closeCart();
                    navigate('/checkout');
                  }}
                  className="mt-4 h-12 w-full rounded-full bg-brick font-body text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-transform duration-150 active:scale-[0.97]"
                >
                  Checkout
                </button>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
