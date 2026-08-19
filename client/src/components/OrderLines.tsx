import type { OrderItem } from '../lib/types';
import { GHS } from '../lib/format';

/**
 * Renders an order's line items from their stored snapshot.
 *
 * `lineTotal` and `unitPrice` come off the order document, not the live menu —
 * a receipt has to keep saying what was actually charged. Orders written before
 * the configurable-item model fall back to their legacy `customizations`.
 */
export default function OrderLines({
  items,
  className = '',
}: {
  items: OrderItem[];
  className?: string;
}) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((it, i) => {
        const summary = [
          it.variant?.name,
          ...(it.selectedOptions ?? []).map((o) => o.name),
          ...(it.customizations ?? []),
        ]
          .filter(Boolean)
          .join(' · ');
        // Legacy orders stored `price`; current ones store lineTotal.
        const total =
          it.lineTotal ?? (it as unknown as { price: number }).price * it.quantity;
        return (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block">
                {it.quantity}× {it.name}
              </span>
              {summary && <span className="block text-xs opacity-60">{summary}</span>}
              {it.specialInstructions && (
                <span className="block text-xs italic opacity-50">“{it.specialInstructions}”</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">{GHS(total)}</span>
          </li>
        );
      })}
    </ul>
  );
}
