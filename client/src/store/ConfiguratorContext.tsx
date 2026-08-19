import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ItemConfigurator, { type ConfiguratorTarget } from '../components/ItemConfigurator';
import { imageForItem } from '../lib/itemImage';
import type { MenuItem } from '../lib/types';
import { useCart, type Configuration, type CartLine } from './CartContext';

/**
 * Owns the item configurator for the whole storefront.
 *
 * Any card, cart line or upsell tile can open it without threading modal state
 * through the tree, and the post-add "add a drink?" step lives here too so it
 * appears no matter where the item was added from.
 */
interface ConfiguratorValue {
  /** Open the configurator for an item. */
  configure: (item: MenuItem) => void;
  /** Reopen it pre-filled for an existing cart line. */
  edit: (line: CartLine, item: MenuItem) => void;
  /**
   * Add an item with the fewest taps that are actually safe: straight into the
   * cart when nothing has to be chosen, otherwise open the configurator.
   */
  quickAdd: (item: MenuItem) => void;
}

const Ctx = createContext<ConfiguratorValue | null>(null);

/** True when an item can be added without asking the customer anything. */
function needsChoices(item: MenuItem): boolean {
  if (item.variants.length > 1) return true;
  return (item.modifierGroups ?? []).some(
    (g) => g.required || g.minSelect > 0
  );
}

/** Rebuilds the configurator's state from a stored cart line. */
function configOf(line: CartLine): Configuration {
  const selections: Record<string, string[]> = {};
  for (const o of line.options) (selections[o.groupId] ??= []).push(o.optionId);
  return {
    variantId: line.variantId,
    selections,
    quantity: line.quantity,
    specialInstructions: line.specialInstructions,
  };
}

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const { addConfigured, replaceLine, closeCart, openCart } = useCart();
  const [target, setTarget] = useState<ConfiguratorTarget | null>(null);
  // The name of the item just added, purely to confirm it landed.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const dismissAt = useRef<number | null>(null);
  // True while the configurator was opened *from* the cart, so closing it
  // returns there instead of leaving the customer on the menu.
  const returnToCart = useRef(false);

  // Adding does NOT open the cart — it confirms and gets out of the way.
  // Short-lived, because all it has to say now is "that landed".
  useEffect(() => {
    if (!justAdded) return;
    const id = window.setTimeout(() => setJustAdded(null), 3500);
    dismissAt.current = id;
    return () => window.clearTimeout(id);
  }, [justAdded]);

  const configure = useCallback((item: MenuItem) => {
    returnToCart.current = false;
    setTarget({ item });
  }, []);

  /**
   * Edit a line from the cart.
   *
   * The drawer is CLOSED first. The two must never be stacked: the drawer is a
   * full-screen fixed container, so leaving it open put its overlay between the
   * customer and the configurator — which rendered, dimmed, and swallowed every
   * click. The z-scale now also guarantees the ordering, but not stacking them
   * at all is the actual fix.
   *
   * Closing the configurator afterwards reopens the drawer, so an edit returns
   * you to the cart you started from rather than dumping you on the menu.
   */
  const edit = useCallback(
    (line: CartLine, item: MenuItem) => {
      closeCart();
      returnToCart.current = true;
      setTarget({ item, editing: { key: line.key, config: configOf(line) } });
    },
    [closeCart]
  );

  const closeConfigurator = useCallback(() => {
    setTarget(null);
    if (returnToCart.current) {
      returnToCart.current = false;
      openCart();
    }
  }, [openCart]);

  const quickAdd = useCallback(
    (item: MenuItem) => {
      if (item.basePrice == null) return;
      if (needsChoices(item)) {
        returnToCart.current = false;
        setTarget({ item });
        return;
      }
      addConfigured(
        item,
        { variantId: item.variants[0]?.id ?? null, selections: {}, quantity: 1 },
        imageForItem(item, 240)
      );
      setJustAdded(item.name);
    },
    [addConfigured]
  );

  const submit = useCallback(
    (item: MenuItem, config: Configuration, editingKey?: string) => {
      const image = imageForItem(item, 240);
      if (editingKey) {
        replaceLine(editingKey, item, config, image);
        // No "added" toast on an edit: nothing was added, and the cart is
        // about to reopen showing the change.
        return;
      }
      addConfigured(item, config, image);
      setJustAdded(item.name);
    },
    [addConfigured, replaceLine]
  );

  const value = useMemo(() => ({ configure, edit, quickAdd }), [configure, edit, quickAdd]);

  return (
    <Ctx.Provider value={value}>
      {children}

      <ItemConfigurator target={target} onClose={closeConfigurator} onSubmit={submit} />

      {/*
        Post-add: a confirmation and the item's add-ons, inline at the bottom.
        Never modal, never focus-stealing, and it times itself out. It sits
        above the mobile cart bar (z-cart-bar; this is z-toast) and carries
        that bar's height in its padding so the two never overlap.
      */}
      <AnimatePresence>
        {justAdded && !target && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-x-0 z-toast border-t border-charcoal/10 bg-creamLt/95 px-4 pb-3 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur"
            style={{
              // Sits ON TOP OF the mobile cart bar rather than over it. Padding
              // alone reserved the space, but this panel's own opaque background
              // still painted across the bar and hid it.
              //
              // No safe-area inset here: the confirmation only ever appears
              // with a non-empty cart, so on mobile the bar is underneath and
              // is already carrying that inset.
              bottom: 'var(--mobile-cart-bar-h, 0px)',
            }}
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 font-body text-sm font-semibold text-charcoal">
                  <span aria-hidden className="mr-1.5 text-success">
                    ✓
                  </span>
                  <span className="truncate">{justAdded} added</span>
                </p>
                <button
                  type="button"
                  onClick={() => setJustAdded(null)}
                  className="shrink-0 rounded-full px-3 py-2 font-body text-xs font-semibold uppercase tracking-wide text-charcoal/60 transition-colors duration-150 hover:text-charcoal"
                >
                  Dismiss
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function useConfigurator(): ConfiguratorValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfigurator must be used inside <ConfiguratorProvider>');
  return ctx;
}
