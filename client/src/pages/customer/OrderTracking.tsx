import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, apiError } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useOnReconnect } from '../../lib/useLiveConnection';
import type { Order, OrderStatus } from '../../lib/types';
import OrderLines from '../../components/OrderLines';
import { GHS, STATUS_LABEL } from '../../lib/format';

const FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!orderId) return;
    api
      .get<Order>(`/orders/${orderId}`)
      .then((r) => setOrder(r.data))
      .catch((e) => setError(apiError(e, 'Order not found')));
  }, [orderId]);

  /**
   * A customer watching this page through a cold start would otherwise sit on
   * a stale status forever: the room is gone and the status event that fired
   * meanwhile is not replayed. Re-subscribe and re-pull on every connection.
   */
  const onConnect = useCallback(() => {
    if (!orderId) return;
    getSocket().emit('order:subscribe', orderId);
    load();
  }, [orderId, load]);
  useOnReconnect(onConnect);

  useEffect(() => {
    if (!orderId) return;

    const socket = getSocket();
    const onUpdate = (updated: Order) => {
      if (updated.orderID === orderId) setOrder(updated);
    };
    socket.on('order:status-updated', onUpdate);
    return () => {
      socket.emit('order:unsubscribe', orderId);
      socket.off('order:status-updated', onUpdate);
    };
  }, [orderId]);

  // No orderId in URL → show a lookup form.
  if (!orderId) {
    return (
      <div className="mx-auto max-w-md px-5 pb-20 pt-12 text-center">
        <h1 className="font-poster text-3xl uppercase text-brand-redDeep">Track your order</h1>
        <p className="mt-2 text-brand-brown/60">Enter your order ID (e.g. VB-8F3K2Q).</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lookup.trim()) navigate(`/track/${lookup.trim().toUpperCase()}`);
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="VB-XXXXXX"
            className="min-h-[44px] flex-1 rounded-full border-2 border-brand-brown/65 bg-brand-paper px-5 font-body text-sm text-brand-brown outline-none transition-colors focus:border-brand-redDeep"
          />
          <button className="btn-primary">Track</button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-5 pb-20 pt-12 text-center">
        <div className="text-6xl">🤔</div>
        <p className="mt-4 text-brand-brown/70">{error}</p>
        <button className="btn-ghost mt-6" onClick={() => navigate('/track')}>Try another ID</button>
      </div>
    );
  }

  if (!order) {
    return <p className="px-5 pt-12 text-center text-brand-brown/50">Loading order…</p>;
  }

  const cancelled = order.status === 'cancelled';
  const currentIdx = FLOW.indexOf(order.status);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-12">
      <div className="overflow-hidden rounded-card border border-brand-brown/20 bg-brand-creamMid">
        <div className="bg-brand-redDeep p-6 text-brand-cream">
          <p className="text-sm text-brand-cream/80">Order</p>
          <h1 className="font-poster text-3xl uppercase tracking-tight">{order.orderID}</h1>
          <p className="mt-1 text-brand-cream/90">
            {cancelled ? '❌ This order was cancelled.' : `⏱ ETA ~${order.estimatedDeliveryTime ?? 30} min`}
          </p>
        </div>

        {!cancelled && (
          <div className="p-6">
            <div className="space-y-1">
              {FLOW.map((step, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={step} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={active ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                        className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                          done ? 'bg-brand-redDeep text-brand-cream' : 'bg-brand-cream text-brand-brown/50'
                        }`}
                      >
                        {done ? '✓' : i + 1}
                      </motion.div>
                      {i < FLOW.length - 1 && (
                        <div className={`h-6 w-0.5 ${i < currentIdx ? 'bg-brand-redDeep' : 'bg-brand-brown/20'}`} />
                      )}
                    </div>
                    <span className={`font-semibold ${active ? 'text-brand-redDeep' : done ? 'text-brand-brown' : 'text-brand-brown/50'}`}>
                      {STATUS_LABEL[step]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-brand-brown/20 p-6">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-brown">Order details</h2>
          <div className="mt-3 space-y-1 text-sm">
            <OrderLines items={order.items} className="text-brand-brown/80" />
            <hr className="my-2" />
            <div className="flex justify-between"><span className="text-brand-brown/60">Delivery</span><span>{GHS(order.deliveryFee)}</span></div>
            <div className="flex justify-between font-display font-extrabold">
              <span>Total</span><span className="text-brand-redDeep">{GHS(order.total)}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-brand-brown/60">
            {order.deliveryMethod === 'delivery'
              ? `🚴 Delivering to ${order.zone} — ${order.deliveryAddress}`
              : '🏃 Pickup at the Viannes Bistro counter'}
            {' · '}Pay: {order.paymentMethod.replace('_', ' ')} ({order.paymentStatus})
          </p>
        </div>
      </div>
    </div>
  );
}
