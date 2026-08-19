import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { GHS } from '../../lib/format';
import type { Order } from '../../lib/types';

/**
 * Post-order confirmation: order number, fulfilment method, total.
 *
 * The order is handed over in router state after checkout, so the happy path
 * paints instantly; a direct visit (or a refresh) re-fetches it by orderID.
 */
export default function Confirmation() {
  const { id } = useParams();
  const location = useLocation();
  const passed = (location.state as { order?: Order } | null)?.order;
  const [order, setOrder] = useState<Order | undefined>(passed);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (order || !id) return;
    let alive = true;
    api
      .get<Order>(`/orders/${id}`)
      .then(({ data }) => alive && setOrder(data))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, order]);

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-28 text-center">
      <p className="font-body text-xs font-semibold uppercase tracking-[0.3em] text-brick">
        Order placed
      </p>
      <h1 className="mt-3 font-poster text-[clamp(2.5rem,12vw,4.5rem)] uppercase leading-[0.9] text-charcoal">
        Thank you
      </h1>

      {order ? (
        <div className="mt-8 rounded-2xl border border-charcoal/[0.08] bg-cream p-6 text-left">
          <Row label="Order number" value={order.orderID} mono />
          <Row
            label="Fulfilment"
            value={order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}
          />
          {order.deliveryMethod === 'delivery' && order.deliveryAddress && (
            <Row label="Deliver to" value={order.deliveryAddress} />
          )}
          <Row label="Total" value={GHS(order.total)} strong />
        </div>
      ) : failed ? (
        <p className="mt-8 font-body text-sm text-charcoal/70">
          Your order went through, but we could not load its details just now. Keep this page's
          address — order <span className="font-semibold">{id}</span>.
        </p>
      ) : (
        <p className="mt-8 font-body text-sm text-charcoal/60">Loading your order…</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to={`/track/${id}`}
          className="inline-flex h-11 items-center rounded-full bg-brick px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-transform active:scale-95"
        >
          Track order
        </Link>
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-full border-[1.5px] border-charcoal/20 px-6 font-body text-xs font-semibold uppercase tracking-[0.2em] text-charcoal transition-transform active:scale-95"
        >
          Back to menu
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-charcoal/10 py-2 last:border-0">
      <span className="font-body text-xs uppercase tracking-wider text-charcoal/60">{label}</span>
      <span
        className={`font-body text-charcoal ${mono ? 'tabular-nums' : ''} ${
          strong ? 'text-lg font-extrabold text-brick' : 'font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
