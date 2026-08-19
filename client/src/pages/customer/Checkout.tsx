import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '../../lib/api';
import { useCart } from '../../store/CartContext';
import { GHS } from '../../lib/format';
import { describeSelections } from '../../lib/pricing';
import { feeFor } from '../../lib/fees';
import CartNotices from '../../components/CartNotices';
import type { Order } from '../../lib/types';

type Method = 'delivery' | 'pickup';
type Pay = 'cash' | 'card' | 'mobile_money';

const PICKUP_POINT = 'Besties kitchen — Night Market, Legon';

/** Ghana mobile: 0XXXXXXXXX (10 digits) or +233XXXXXXXXX. */
const PHONE_RE = /^(0\d{9}|\+233\d{9})$/;
/** Deliberately permissive — the server and Paystack are the real arbiters. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Every control on this page is the same height and radius — text inputs and
 * both segmented controls — so the form column reads as one system rather than
 * as three different widgets stacked up.
 */
const CONTROL = 'h-12 rounded-xl';
const field = `${CONTROL} w-full border border-charcoal/15 bg-white px-4 font-body text-sm text-charcoal outline-none transition-colors duration-150 focus:border-brick`;
const segment = `${CONTROL} flex-1 border px-3 font-body text-sm font-semibold transition-colors duration-150`;
const segmentOn = 'border-brick bg-brick text-cream';
const segmentOff = 'border-charcoal/15 bg-white text-charcoal hover:border-brick/40';

/**
 * Single-screen checkout. Not a wizard — this is a campus food order.
 *
 * Client-side validation is for user experience only. The server re-prices
 * every line from the database and is the authority on the totals.
 */
export default function Checkout() {
  const { lines, subtotal, clearCart, toOrderItems, priceNotices, issues, dismissNotices } =
    useCart();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<Method>('delivery');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState<Pay>('mobile_money');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const inFlight = useRef(false);

  // Display only — the server computes the fee it actually charges. See
  // lib/fees.ts and server/src/config/fees.ts.
  const deliveryFee = useMemo(() => feeFor(method), [method]);
  const total = subtotal + deliveryFee;
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  const phoneValid = PHONE_RE.test(phone.trim());
  const nameValid = name.trim().length >= 2;
  const locationValid = method === 'pickup' || location.trim().length > 1;
  // Paystack will not open a transaction without a real address, and it is
  // where the customer's receipt goes. Cash never touches the gateway, so
  // there the field is genuinely optional — but still validated if filled in.
  const emailRequired = pay !== 'cash';
  const emailValid = email.trim()
    ? EMAIL_RE.test(email.trim())
    : !emailRequired;
  const valid = nameValid && phoneValid && emailValid && locationValid;
  // The button stays live while the form is incomplete: a disabled button tells
  // the user nothing. Submitting reveals what's missing. It only locks in flight.
  const canSubmit = lines.length > 0 && !submitting;

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || !canSubmit || inFlight.current) return;
    inFlight.current = true;
    setError('');
    setSubmitting(true);
    try {
      // Only ids, selections and quantities go up. The server prices every
      // line itself; `expectedSubtotal` is a cross-check, not an instruction —
      // if it disagrees with the server's own arithmetic the order is refused
      // rather than silently charged at a different figure.
      const { data } = await api.post<Order & { authorizationUrl?: string }>('/orders', {
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        },
        items: toOrderItems(),
        expectedSubtotal: subtotal,
        deliveryMethod: method,
        deliveryAddress: method === 'delivery' ? location.trim() : undefined,
        paymentMethod: pay,
        notes: notes.trim() || undefined,
      });

      // Card and mobile money hand off to Paystack. The cart is deliberately
      // NOT cleared here — if the customer abandons the gateway, their order is
      // still sitting in front of them. /payment/callback clears it once the
      // server has verified the money actually arrived.
      if (data.authorizationUrl) {
        window.location.assign(data.authorizationUrl);
        return;
      }

      // Cash on delivery: nothing to pay now.
      clearCart();
      navigate(`/order/${data.orderID}`, { state: { order: data } });
    } catch (err) {
      // Keep the cart fully intact and say what actually happened.
      setError(apiError(err, 'We could not place your order. Please try again.'));
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-20 pt-28 text-center sm:px-8">
        <p className="font-body text-charcoal/70">Your cart is empty.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-brick px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-cream"
        >
          Browse menu
        </Link>
      </div>
    );
  }

  const payLabel = pay === 'cash' ? 'Place order' : `Pay ${GHS(total)}`;
  const paySubLabel = pay === 'cash' ? GHS(total) : 'via Paystack';

  const payButton = (
    <button
      type="submit"
      disabled={!canSubmit}
      className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-brick px-4 py-2.5 text-cream transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
    >
      <span className="flex items-center gap-2 text-center font-body text-xs font-semibold uppercase tracking-[0.18em]">
        {submitting && (
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cream/40 border-t-cream"
          />
        )}
        {submitting ? 'Placing order' : payLabel}
      </span>
      {!submitting && (
        <span className="font-body text-[0.7rem] tabular-nums text-cream/80">{paySubLabel}</span>
      )}
    </button>
  );

  return (
    // ONE centred container holds the title, the form and the summary, so the
    // heading and the first field share a left edge. No inner max-widths.
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-32 pt-24 sm:px-8 lg:pb-24">
      <h1 className="font-poster text-[clamp(2rem,9vw,3.5rem)] uppercase text-charcoal">Checkout</h1>

      {/*
        minmax(0,1fr) — not 1fr — is load-bearing. A bare `1fr` track is
        `minmax(auto, 1fr)`, and its `auto` minimum is the column's MIN-CONTENT
        width. The payment control's three-up grid gave this column a 792px
        min-content, so the track refused to shrink and shoved the fixed 360px
        summary clean off the right of the viewport.
      */}
      <form
        onSubmit={placeOrder}
        className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/* ── Form column. Capped at a readable measure: a 700px-wide "Name"
            field is what made the old page feel unbalanced. */}
        <div className="min-w-0 max-w-[34rem] space-y-6">
          <Group label="Name" htmlFor="co-name" error={touched && !nameValid ? 'Enter your name.' : undefined}>
            <input
              id="co-name"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </Group>

          <Group
            label="Phone"
            htmlFor="co-phone"
            error={touched && !phoneValid ? 'Use 0XXXXXXXXX or +233XXXXXXXXX.' : undefined}
          >
            <input
              id="co-phone"
              className={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0551234567"
              inputMode="tel"
              autoComplete="tel"
            />
          </Group>

          <Group
            label="Email"
            htmlFor="co-email"
            optional={!emailRequired}
            hint={
              emailRequired
                ? 'Your receipt from Paystack goes here.'
                : 'Add one if you would like a receipt.'
            }
            error={
              touched && !emailValid
                ? email.trim()
                  ? 'That does not look like an email address.'
                  : 'Paystack needs an email address to take the payment.'
                : undefined
            }
          >
            <input
              id="co-email"
              className={field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </Group>

          <fieldset className="min-w-0">
            <Legend>Fulfilment</Legend>
            <div className="flex gap-2">
              {(['delivery', 'pickup'] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={`${segment} capitalize ${method === m ? segmentOn : segmentOff}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </fieldset>

          {method === 'delivery' ? (
            <>
              <Group
                label="Hall / hostel / location"
                htmlFor="co-loc"
                error={touched && !locationValid ? 'Tell the rider where to go.' : undefined}
              >
                <input
                  id="co-loc"
                  className={field}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Pentagon Hostel, Block C"
                />
              </Group>
              <Group
                label="Delivery notes"
                htmlFor="co-notes"
                optional
              >
                <input
                  id="co-notes"
                  className={field}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Call when you arrive"
                />
              </Group>
            </>
          ) : (
            <div className="rounded-xl bg-cream px-4 py-3 font-body text-sm text-charcoal">
              <span className="font-semibold">Pick up from:</span> {PICKUP_POINT}
            </div>
          )}

          <fieldset className="min-w-0">
            <Legend>Payment</Legend>
            {/* Wraps rather than forcing three columns — that forced track is
                what set the old min-content floor. */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['mobile_money', 'Mobile Money'],
                  ['card', 'Card'],
                  ['cash', 'Cash on delivery'],
                ] as [Pay, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPay(value)}
                  aria-pressed={pay === value}
                  className={`${segment} min-w-[8rem] ${pay === value ? segmentOn : segmentOff}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* ── Summary column. Sticky, so it stays with you as the form scrolls. */}
        <aside className="min-w-0 rounded-2xl border border-charcoal/[0.08] bg-cream p-5 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-poster text-xl uppercase text-charcoal">Summary</h2>

          <ul className="mt-3 space-y-3 font-body text-sm text-charcoal">
            {lines.map((l) => {
              const summary = describeSelections(
                l.variantName,
                l.options.map((o) => o.name)
              );
              return (
                <li key={l.key} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {l.quantity}× {l.name}
                    </span>
                    {summary && (
                      <span className="mt-0.5 line-clamp-2 text-xs text-charcoal/60">
                        {summary}
                      </span>
                    )}
                    {l.specialInstructions && (
                      <span className="mt-0.5 line-clamp-2 text-xs italic text-charcoal/50">
                        “{l.specialInstructions}”
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {GHS(l.unitPrice * l.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>

          <CartNotices
            priceNotices={priceNotices}
            issues={issues}
            onDismiss={dismissNotices}
            className="mt-3"
          />

          <dl className="mt-4 space-y-1.5 border-t border-charcoal/10 pt-3 font-body text-sm text-charcoal">
            <Row label={`Items (${itemCount})`} value={GHS(subtotal)} />
            <Row
              label={method === 'pickup' ? 'Pickup' : 'Delivery'}
              value={deliveryFee ? GHS(deliveryFee) : <span className="text-success">Free</span>}
            />
            <Row label="Tax" value="Included" muted />
            <div className="flex items-baseline justify-between gap-4 border-t border-charcoal/10 pt-2 text-base font-extrabold">
              <dt className="min-w-0 truncate">Total</dt>
              <dd className="shrink-0 text-right tabular-nums text-brick">{GHS(total)}</dd>
            </div>
          </dl>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-brick/10 px-3 py-2 font-body text-sm text-brick"
            >
              {error}
            </p>
          )}

          {/* Below lg the action lives in the sticky bar instead. */}
          <div className="mt-4 hidden lg:block">{payButton}</div>
        </aside>

        {/*
          Mobile / tablet: the pay action is pinned to the bottom, showing the
          total so it never scrolls out of reach. Inside the form so it submits.
        */}
        <div
          className="fixed inset-x-0 bottom-0 z-cart-bar border-t border-charcoal/10 bg-creamLt/95 px-5 pt-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex w-full max-w-[1120px] items-center gap-4">
            <div className="min-w-0">
              <p className="font-body text-[0.65rem] font-semibold uppercase tracking-wider text-charcoal/60">
                Total
              </p>
              <p className="font-body text-lg font-extrabold tabular-nums text-brick">
                {GHS(total)}
              </p>
            </div>
            <div className="min-w-0 flex-1">{payButton}</div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- small building blocks, so every group has the same rhythm ---------- */

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <legend className="mb-1.5 font-body text-xs font-semibold uppercase tracking-wider text-charcoal/70">
      {children}
    </legend>
  );
}

function Group({
  label,
  htmlFor,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-body text-xs font-semibold uppercase tracking-wider text-charcoal/70"
      >
        {label}
        {optional && <span className="ml-1 font-normal normal-case">(optional)</span>}
      </label>
      {children}
      {/* The hint keeps its line whether or not it is showing, so switching
          payment method cannot reflow the form under the customer's finger. */}
      {(error || hint) && (
        <p className={`mt-1 font-body text-xs ${error ? 'text-brick' : 'text-charcoal/50'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** A summary row: label truncates, amount never wraps and never clips. */
function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${muted ? 'text-charcoal/60' : ''}`}>
      <dt className="min-w-0 truncate">{label}</dt>
      <dd className="shrink-0 text-right tabular-nums">{value}</dd>
    </div>
  );
}
