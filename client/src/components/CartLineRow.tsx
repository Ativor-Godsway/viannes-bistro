import type { CartLine } from '../store/CartContext';
import { GHS } from '../lib/format';
import { describeSelections } from '../lib/pricing';

interface Props {
  line: CartLine;
  onEdit?: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}

/**
 * One configured line: thumbnail, name, the chosen options as a muted
 * sub-line, quantity stepper, edit and remove.
 *
 * The sub-line is what makes two visually identical lines legible — without it
 * "Pizza ×1" twice looks like a bug rather than two different pizzas.
 */
export default function CartLineRow({ line, onEdit, onQuantity, onRemove }: Props) {
  const summary = describeSelections(
    line.variantName,
    line.options.map((o) => o.name)
  );

  return (
    <li className="flex items-start gap-3 py-3">
      <div className="relative grid h-14 w-14 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full bg-brick" />
        {line.image && (
          <img
            src={line.image}
            alt=""
            aria-hidden
            className="relative h-12 w-12 object-contain"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-poster text-base uppercase text-charcoal">{line.name}</p>
        {summary && (
          <p className="mt-0.5 line-clamp-2 font-body text-xs text-charcoal/60">{summary}</p>
        )}
        {line.specialInstructions && (
          <p className="mt-0.5 line-clamp-1 font-body text-xs italic text-charcoal/50">
            “{line.specialInstructions}”
          </p>
        )}
        <p className="mt-1 font-body text-sm font-bold tabular-nums text-brick">
          {GHS(line.unitPrice * line.quantity)}
          {line.quantity > 1 && (
            <span className="ml-1 font-normal text-charcoal/50">({GHS(line.unitPrice)} ea)</span>
          )}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-1 font-body text-xs font-semibold uppercase tracking-wide text-charcoal/60 underline transition-colors duration-150 hover:text-brick"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onQuantity(line.quantity - 1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-charcoal/15 text-lg leading-none text-charcoal transition-transform duration-150 active:scale-95"
          aria-label={`Remove one ${line.name}`}
        >
          −
        </button>
        <span className="w-6 text-center font-body text-sm font-bold tabular-nums">
          {line.quantity}
        </span>
        <button
          type="button"
          onClick={() => onQuantity(line.quantity + 1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-charcoal/15 text-lg leading-none text-charcoal transition-transform duration-150 active:scale-95"
          aria-label={`Add one more ${line.name}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-11 w-11 place-items-center rounded-full text-charcoal/50 transition-transform duration-150 active:scale-95"
          aria-label={`Remove ${line.name} from cart`}
        >
          ×
        </button>
      </div>
    </li>
  );
}
