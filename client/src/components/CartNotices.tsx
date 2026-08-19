import type { CartLine } from '../store/CartContext';
import type { PriceNotice } from '../store/CartContext';
import { GHS } from '../lib/format';

interface Props {
  priceNotices: PriceNotice[];
  issues: CartLine[];
  onDismiss: () => void;
  className?: string;
}

/**
 * What revalidation changed under the customer's feet.
 *
 * Dropped lines are stated plainly rather than silently vanishing — a cart
 * that quietly loses an item is worse than one that explains why.
 */
export default function CartNotices({ priceNotices, issues, onDismiss, className = '' }: Props) {
  if (!priceNotices.length && !issues.length) return null;
  return (
    // Orange is an accent, not a panel: it carries the eye here as a rule down
    // the edge, and the text sits on creamDeep at 6.3:1 rather than on a wash
    // of orange that no text clears.
    <div
      className={`rounded-xl border-l-[3px] border-brand-orange bg-brand-creamDeep px-3 py-2 font-body text-xs text-brand-brown ${className}`}
    >
      {issues.map((l) => (
        <p key={l.key}>{l.issue} — it has been removed from your cart.</p>
      ))}
      {priceNotices.map((n) => (
        <p key={`${n.name}-${n.to}`}>
          {n.name} is now {GHS(n.to)} (was {GHS(n.from)}).
        </p>
      ))}
      <button type="button" onClick={onDismiss} className="mt-1 font-semibold underline">
        Got it
      </button>
    </div>
  );
}
