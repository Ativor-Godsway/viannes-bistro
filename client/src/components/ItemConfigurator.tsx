import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MenuItem, ModifierGroup } from '../lib/types';
import { GHS } from '../lib/format';
import { imageForItem, altForItem } from '../lib/itemImage';
import {
  firstUnmetGroup,
  groupIsFull,
  resolveVariant,
  unitPrice,
  unmetCount,
  type Selections,
} from '../lib/pricing';
import type { Configuration } from '../store/CartContext';
import { lockScroll, unlockScroll } from '../lib/scrollLock';

export interface ConfiguratorTarget {
  item: MenuItem;
  /** Present when editing an existing cart line rather than adding a new one. */
  editing?: { key: string; config: Configuration };
  /**
   * Quantity to open on, for callers that already asked the customer how many
   * they wanted (the homepage feature block has its own stepper). Defaults to
   * 1, so every existing caller is unaffected. Ignored when editing, where the
   * line's own quantity wins.
   */
  initialQuantity?: number;
}

interface Props {
  target: ConfiguratorTarget | null;
  onClose: () => void;
  onSubmit: (item: MenuItem, config: Configuration, editingKey?: string) => void;
}

/** A price delta rendered the way a menu does: "+GH₵12.00", or nothing at 0. */
function Delta({ amount }: { amount: number }) {
  if (!amount) return null;
  return (
    <span className="shrink-0 font-body text-xs font-semibold tabular-nums text-brand-brown/60">
      {amount > 0 ? '+' : '−'}
      {GHS(Math.abs(amount))}
    </span>
  );
}

function groupHint(group: ModifierGroup): string {
  const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
  if (group.type === 'single') return group.required ? 'Required · choose 1' : 'Choose 1';
  if (min && group.maxSelect) return `Choose ${min}–${group.maxSelect}`;
  if (min) return `Required · choose at least ${min}`;
  if (group.maxSelect) return `Optional · up to ${group.maxSelect}`;
  return 'Optional';
}

/**
 * The item configurator.
 *
 * Everything about a line is decided here — size, modifiers, quantity, notes —
 * and the footer price recomputes on every change so the customer never has to
 * guess what an option costs. Required groups keep "Add to cart" inert, and
 * pressing it scrolls the first unmet group into view and flags it, which is
 * more useful than a disabled button that explains nothing.
 */
export default function ItemConfigurator({ target, onClose, onSubmit }: Props) {
  const item = target?.item ?? null;
  const editing = target?.editing;

  const [variantId, setVariantId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Selections>({});
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [flagged, setFlagged] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // Reset to the item's defaults on open, or to the line being edited.
  useEffect(() => {
    if (!item) return;
    if (editing) {
      setVariantId(editing.config.variantId ?? null);
      setSelections(editing.config.selections);
      setQuantity(editing.config.quantity);
      setInstructions(editing.config.specialInstructions ?? '');
    } else {
      setVariantId(resolveVariant(item, null)?.id ?? null);
      setSelections(Object.fromEntries((item.modifierGroups ?? []).map((g) => [g.id, []])));
      // Clamped: the caller's stepper is UI, not a trusted source.
      setQuantity(Math.max(1, Math.min(99, Math.round(target?.initialQuantity ?? 1))));
      setInstructions('');
    }
    setFlagged(null);
    setImageFailed(false);
    groupRefs.current = {};
  }, [item, editing, target?.initialQuantity]);

  /**
   * Escape closes; the page behind is pinned while the sheet is open and put
   * back on exactly the same pixel when it closes — the customer must land on
   * the card they tapped, not at the top of the menu.
   *
   * Focus moves into the dialog and is trapped there, then restored to
   * whatever opened it. Without this the modal was announced but keyboard focus
   * stayed on the page behind, so Tab walked through the menu underneath an
   * `aria-modal` dialog.
   */
  useEffect(() => {
    if (!item) return;
    restoreFocusTo.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    // requestAnimationFrame: the panel is mid-enter-animation on this tick.
    const raf = requestAnimationFrame(() =>
      panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'button, [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((el) => el.offsetParent !== null);
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
    lockScroll();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      unlockScroll();
      restoreFocusTo.current?.focus?.();
    };
  }, [item, onClose]);

  const heroSrc = item ? imageForItem(item, 640) : '';

  const price = useMemo(
    () => (item ? unitPrice(item, variantId, selections) : null),
    [item, variantId, selections]
  );
  const unmet = useMemo(
    () => (item ? firstUnmetGroup(item, selections) : null),
    [item, selections]
  );

  function toggle(group: ModifierGroup, optionId: string) {
    setFlagged((f) => (f === group.id ? null : f));
    setSelections((prev) => {
      const chosen = prev[group.id] ?? [];
      if (group.type === 'single') {
        // Tapping the chosen option again clears it, unless it is required —
        // a required group should never be emptied by a stray tap.
        const isChosen = chosen[0] === optionId;
        const next = isChosen && !group.required ? [] : [optionId];
        return { ...prev, [group.id]: next };
      }
      if (chosen.includes(optionId)) {
        return { ...prev, [group.id]: chosen.filter((id) => id !== optionId) };
      }
      if (groupIsFull(group, chosen)) return prev;
      return { ...prev, [group.id]: [...chosen, optionId] };
    });
  }

  function submit() {
    if (!item) return;
    if (unmet) {
      setFlagged(unmet.id);
      groupRefs.current[unmet.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    onSubmit(
      item,
      {
        variantId,
        selections,
        quantity,
        specialInstructions: instructions.trim() || undefined,
      },
      editing?.key
    );
    onClose();
  }

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-configurator flex items-end justify-center bg-brand-ink/60 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Configure ${item.name}`}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-brand-cream sm:max-h-[88vh] sm:rounded-card"
            initial={{ y: '4%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '6%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {/* Hero image. 640 is resolved against the generated manifest, so
                  it can never request a width the pipeline did not emit. */}
              <div className="relative aspect-[16/10] bg-brand-creamMid">
                {heroSrc && !imageFailed ? (
                  <img
                    src={heroSrc}
                    alt={altForItem(item)}
                    className="h-full w-full object-contain p-6"
                    // A missing or blocked file shows the placeholder rather
                    // than a broken-image icon and its alt text.
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-6xl" aria-hidden>
                    🍽️
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  data-autofocus
                  className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-brand-paper/90 text-xl text-brand-brown shadow-sm transition-transform duration-150 active:scale-95"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 px-5 pb-6 pt-5">
                <header>
                  <h2 className="font-poster text-2xl uppercase leading-tight text-brand-redDeep">
                    {item.name}
                  </h2>
                  {item.description && (
                    <p className="mt-1 font-body text-sm text-brand-brown/70">{item.description}</p>
                  )}
                  <p className="mt-2 font-body text-xs text-brand-brown/50">
                    ⏱ ~{item.preparationTime} min prep
                  </p>
                </header>

                {/* Sizes */}
                {item.variants.length > 0 && (
                  <section>
                    <SectionHead title="Size" hint="Required · choose 1" />
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {item.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          aria-pressed={variantId === v.id}
                          onClick={() => setVariantId(v.id)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-left font-body text-sm transition-colors duration-150 ${
                            variantId === v.id
                              ? 'border-brand-redDeep bg-brand-redDeep text-brand-cream'
                              : 'border-brand-brown/65 bg-brand-paper text-brand-brown hover:border-brand-redDeep'
                          }`}
                        >
                          <span className="block font-semibold">{v.name}</span>
                          {item.basePrice != null && (
                            <span className="block text-xs tabular-nums opacity-80">
                              {GHS(item.basePrice + v.priceDelta)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Modifier groups */}
                {(item.modifierGroups ?? []).map((group) => {
                  const chosen = selections[group.id] ?? [];
                  const isFlagged = flagged === group.id;
                  const full = groupIsFull(group, chosen);
                  return (
                    <section
                      key={group.id}
                      ref={(el) => {
                        groupRefs.current[group.id] = el;
                      }}
                      className={`rounded-2xl transition-colors duration-150 ${
                        isFlagged ? 'bg-brand-red/10 p-3 ring-1 ring-brand-red' : ''
                      }`}
                    >
                      <SectionHead
                        title={group.name}
                        hint={groupHint(group)}
                        error={
                          isFlagged
                            ? `Choose ${unmetCount(group, chosen)} more to continue`
                            : undefined
                        }
                      />
                      <ul className="mt-2 divide-y divide-brand-brown/20 overflow-hidden rounded-xl bg-brand-paper">
                        {group.options.map((option) => {
                          const isOn = chosen.includes(option.id);
                          const locked = !option.available || (full && !isOn);
                          return (
                            <li key={option.id}>
                              <label
                                className={`flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 ${
                                  locked ? 'cursor-not-allowed opacity-40' : 'hover:bg-brand-creamMid/60'
                                }`}
                              >
                                <input
                                  type={group.type === 'single' ? 'radio' : 'checkbox'}
                                  name={group.id}
                                  checked={isOn}
                                  disabled={locked}
                                  onChange={() => toggle(group, option.id)}
                                  className="h-4 w-4 shrink-0 accent-brick"
                                />
                                <span className="min-w-0 flex-1 font-body text-sm text-brand-brown">
                                  {option.name}
                                  {!option.available && (
                                    <span className="ml-2 text-xs uppercase tracking-wide text-brand-redDeep">
                                      sold out
                                    </span>
                                  )}
                                </span>
                                <Delta amount={option.priceDelta} />
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}

                {/* Special instructions */}
                <section>
                  <SectionHead title="Special instructions" hint="Optional" />
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="No onions, extra napkins…"
                    className="mt-2 w-full resize-none rounded-xl border border-brand-brown/65 bg-brand-paper px-4 py-3 font-body text-sm text-brand-brown outline-none transition-colors duration-150 focus:border-brand-redDeep"
                  />
                </section>
              </div>
            </div>

            {/* Sticky footer — quantity and the live total. */}
            <footer
              className="flex items-center gap-3 border-t border-brand-brown/20 bg-brand-creamMid px-5 pt-4"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-1 rounded-full border border-brand-brown/65 bg-brand-paper">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="grid h-11 w-11 place-items-center rounded-full text-lg leading-none text-brand-brown transition-transform duration-150 active:scale-95"
                >
                  −
                </button>
                <span className="w-6 text-center font-body text-sm font-bold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  aria-label="Increase quantity"
                  className="grid h-11 w-11 place-items-center rounded-full text-lg leading-none text-brand-brown transition-transform duration-150 active:scale-95"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={price == null}
                aria-disabled={!!unmet}
                className={`h-12 flex-1 rounded-full font-body text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  unmet
                    ? 'bg-brand-ink/20 text-brand-brown/60'
                    : 'bg-brand-red text-brand-cream active:scale-[0.97]'
                }`}
              >
                {price == null
                  ? 'Coming soon'
                  : unmet
                    ? `Choose ${unmet.name}`
                    : `${editing ? 'Update' : 'Add to cart'} — ${GHS(price * quantity)}`}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionHead({
  title,
  hint,
  error,
}: {
  title: string;
  hint: string;
  error?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-body text-sm font-bold uppercase tracking-wide text-brand-brown">{title}</h3>
      <span className={`font-body text-xs ${error ? 'font-semibold text-brand-redDeep' : 'text-brand-brown/50'}`}>
        {error ?? hint}
      </span>
    </div>
  );
}
