import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useOnReconnect, useVisiblePolling } from '../../lib/useLiveConnection';
import ConnectionIndicator from '../../components/admin/ConnectionIndicator';
import type { Order, OrderStatus } from '../../lib/types';
import { GHS, STATUS_LABEL } from '../../lib/format';
import OrderLines from '../../components/OrderLines';
import {
  Button,
  Card,
  DataTable,
  Input,
  Modal,
  PageHeader,
  StatusPill,
  type Column,
} from '../../components/admin/ui';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

const STATUS_FILTERS: (OrderStatus | 'all')[] = [
  'all',
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (filter !== 'all') params.status = filter;
    if (search.trim()) params.search = search.trim();
    api
      .get<Order[]>('/admin/orders', { params })
      .then((r) => setOrders(r.data))
      .catch((e) => setError(apiError(e)));
  }, [filter, search]);

  /**
   * Every (re)connection refetches and re-joins the admin room.
   *
   * Room membership does not survive a server restart, and events fired while
   * we were disconnected are never replayed — so an order placed during a
   * Render cold start would otherwise never appear here. This is the reason
   * the cold start is survivable rather than silently lossy.
   */
  const onConnect = useCallback(() => {
    getSocket().emit('admin:join');
    load();
  }, [load]);
  useOnReconnect(onConnect);

  // Safety net: even with a permanently dead socket the list is never more
  // than a minute stale. Suspended while the tab is hidden.
  useVisiblePolling(load, 60_000);

  // Live updates — new orders prepend, status updates patch in place, and a
  // new order still beeps.
  useEffect(() => {
    const socket = getSocket();
    const onNew = (o: Order) => {
      // Play a subtle beep for new orders.
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        /* audio may be blocked before user interaction */
      }
      setOrders((prev) => (prev.some((p) => p._id === o._id) ? prev : [o, ...prev]));
    };
    const onUpdate = (o: Order) => setOrders((prev) => prev.map((p) => (p._id === o._id ? o : p)));
    socket.on('order:new', onNew);
    socket.on('order:status-updated', onUpdate);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:status-updated', onUpdate);
    };
  }, []);

  async function updateStatus(order: Order, status: OrderStatus) {
    try {
      const { data } = await api.patch<Order>(`/admin/orders/${order.orderID}/status`, { status });
      setOrders((prev) => prev.map((p) => (p._id === data._id ? data : p)));
      setSelected((s) => (s && s._id === data._id ? data : s));
    } catch (e) {
      setError(apiError(e));
    }
  }

  const columns: Column<Order>[] = [
    {
      key: 'id',
      header: 'Order',
      render: (o) => <span className="font-medium">{o.orderID}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <span>
          <span className="block">{o.customer.name}</span>
          <span className="block text-xs text-admin-subtle">{o.customer.phone}</span>
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      secondary: true,
      numeric: true,
      render: (o) => o.items.reduce((n, i) => n + i.quantity, 0),
    },
    { key: 'total', header: 'Total', numeric: true, render: (o) => GHS(o.total) },
    { key: 'status', header: 'Status', render: (o) => <StatusPill status={o.status} /> },
    {
      key: 'action',
      header: 'Action',
      render: (o) =>
        NEXT[o.status] ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              updateStatus(o, NEXT[o.status]!);
            }}
          >
            → {STATUS_LABEL[NEXT[o.status]!]}
          </Button>
        ) : (
          <span className="text-admin-subtle">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Live — new orders appear automatically."
        // Was a hardcoded "Live" badge that claimed live updates whether or
        // not the socket was actually connected.
        action={<ConnectionIndicator />}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order ID, name or phone"
          className="sm:max-w-xs"
        />
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                filter === s
                  ? 'bg-brand-red text-white'
                  : 'bg-admin-surface text-admin-muted ring-1 ring-admin-line hover:text-admin-ink'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(o) => o._id}
          onRowClick={setSelected}
          empty="No orders match."
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.orderID ?? 'Order'}
        footer={
          selected && (
            <>
              {!['delivered', 'cancelled'].includes(selected.status) && (
                <Button variant="danger" onClick={() => updateStatus(selected, 'cancelled')}>
                  Cancel order
                </Button>
              )}
              {NEXT[selected.status] && (
                <Button variant="primary" onClick={() => updateStatus(selected, NEXT[selected.status]!)}>
                  Advance to {STATUS_LABEL[NEXT[selected.status]!]}
                </Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <StatusPill status={selected.status} />

            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ['Customer', `${selected.customer.name} · ${selected.customer.phone}`],
                [
                  'Fulfilment',
                  selected.deliveryMethod === 'delivery'
                    ? `Delivery — ${selected.zone ?? ''} ${selected.deliveryAddress ?? ''}`.trim()
                    : 'Pickup',
                ],
                ['Payment', `${selected.paymentMethod.replace('_', ' ')} (${selected.paymentStatus})`],
                ...(selected.notes ? [['Notes', selected.notes]] : []),
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-admin-subtle">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-admin-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl bg-admin-bg p-4">
              <OrderLines items={selected.items} className="text-admin-ink" />
              <dl className="mt-3 space-y-1 border-t border-admin-line pt-3">
                <div className="flex justify-between text-admin-muted">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{GHS(selected.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-admin-muted">
                  <dt>Delivery</dt>
                  <dd className="tabular-nums">{GHS(selected.deliveryFee)}</dd>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-admin-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{GHS(selected.total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
