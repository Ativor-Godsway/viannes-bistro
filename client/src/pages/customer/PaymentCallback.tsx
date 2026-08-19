import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiError } from '../../lib/api';
import { useCart } from '../../store/CartContext';
import { GHS } from '../../lib/format';
import type { Order } from '../../lib/types';

type Phase = 'checking' | 'paid' | 'failed' | 'error';

/**
 * Where Paystack returns the customer after payment.
 *
 * This page proves nothing on its own — landing here is just a navigation.
 * It asks the server to verify the reference against Paystack, and the server
 * is what decides whether the order is paid. The pending state is honest about
 * that: it says "confirming", not "paid".
 */
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref') ?? '';
  const [phase, setPhase] = useState<Phase>('checking');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const asked = useRef(false);

  useEffect(() => {
    if (!reference) {
      setPhase('error');
      setError('No payment reference came back from Paystack.');
      return;
    }
    if (asked.current) return;
    asked.current = true;

    api
      .get<{ paid: boolean; order: Order }>(`/payments/paystack/verify/${reference}`)
      .then(({ data }) => {
        setOrder(data.order);
        if (data.paid) {
          // Only clear the cart once the money is actually confirmed.
          clearCart();
          setPhase('paid');
        } else {
          setPhase('failed');
        }
      })
      .catch((err) => {
        setPhase('error');
        setError(apiError(err, 'We could not confirm your payment.'));
      });
  }, [reference, clearCart]);

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-5 pb-20 pt-12 text-center">
      <div>
        {phase === 'checking' && (
          <>
            <span
              aria-hidden
              className="mx-auto block h-10 w-10 animate-spin rounded-full border-[3px] border-brand-brown/15 border-t-brand-red"
            />
            <h1 className="mt-5 font-poster text-2xl uppercase text-brand-redDeep">
              Confirming payment
            </h1>
            <p className="mt-2 font-body text-sm text-brand-brown/70">
              Checking with Paystack. This takes a second — don't close the page.
            </p>
          </>
        )}

        {phase === 'paid' && order && (
          <>
            <span aria-hidden className="text-5xl">
              ✅
            </span>
            <h1 className="mt-4 font-poster text-2xl uppercase text-brand-redDeep">Payment received</h1>
            <p className="mt-2 font-body text-sm text-brand-brown/70">
              {order.orderID} · {GHS(order.total)} — the kitchen has it.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/track/${order.orderID}`)}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-brand-red px-6 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream"
            >
              Track my order
            </button>
          </>
        )}

        {phase === 'failed' && (
          <>
            <span aria-hidden className="text-5xl">
              ⚠️
            </span>
            <h1 className="mt-4 font-poster text-2xl uppercase text-brand-redDeep">Payment not completed</h1>
            <p className="mt-2 font-body text-sm text-brand-brown/70">
              Paystack didn't confirm this one. Nothing has been charged, and your cart is
              untouched — you can try again.
            </p>
            <Link
              to="/checkout"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-brand-red px-6 font-display text-xs font-semibold uppercase tracking-wide text-brand-cream"
            >
              Back to checkout
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <span aria-hidden className="text-5xl">
              ⚠️
            </span>
            <h1 className="mt-4 font-poster text-2xl uppercase text-brand-redDeep">
              Couldn't confirm
            </h1>
            <p className="mt-2 font-body text-sm text-brand-brown/70">{error}</p>
            <p className="mt-2 font-body text-xs text-brand-brown/50">
              If money left your account, it will reconcile automatically — Paystack notifies us
              separately. Keep your reference: {reference || '—'}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex h-11 items-center rounded-full border-[1.5px] border-brand-brown/20 px-6 font-display text-xs font-semibold uppercase tracking-wide text-brand-brown"
            >
              Back to menu
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
