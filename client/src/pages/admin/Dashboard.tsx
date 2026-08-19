import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useOnReconnect } from '../../lib/useLiveConnection';
import type { Order } from '../../lib/types';
import { GHS } from '../../lib/format';
import {
  Card,
  CardHeader,
  DataTable,
  PageHeader,
  StatTile,
  StatusPill,
  type Column,
} from '../../components/admin/ui';

interface DashboardData {
  orders: { total: number; today: number; byStatus: Record<string, number> };
  revenue: { total: number; today: number; avgOrderValue: number };
  recent: Order[];
}

const COLUMNS: Column<Order>[] = [
  {
    key: 'id',
    header: 'Order',
    render: (o) => <span className="font-medium text-admin-ink">{o.orderID}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    secondary: true,
    render: (o) => <span className="text-admin-muted">{o.customer.name}</span>,
  },
  { key: 'total', header: 'Total', numeric: true, render: (o) => GHS(o.total) },
  { key: 'status', header: 'Status', render: (o) => <StatusPill status={o.status} /> },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(
    () =>
      api
        .get<DashboardData>('/admin/dashboard')
        .then((r) => setData(r.data))
        .catch(() => {}),
    []
  );

  // Counters are derived from every order, so a missed event skews them until
  // the next refetch. Re-pull on every (re)connect, and re-join the room.
  const onConnect = useCallback(() => {
    getSocket().emit('admin:join');
    void load();
  }, [load]);
  useOnReconnect(onConnect);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => load();
    socket.on('order:new', refresh);
    socket.on('order:status-updated', refresh);
    return () => {
      socket.off('order:new', refresh);
      socket.off('order:status-updated', refresh);
    };
  }, []);

  const active =
    (data?.orders.byStatus.pending ?? 0) +
    (data?.orders.byStatus.confirmed ?? 0) +
    (data?.orders.byStatus.preparing ?? 0) +
    (data?.orders.byStatus.ready ?? 0);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of the shop." />

      {/* Top row: a wide primary panel beside a narrower stats column. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="flex flex-col justify-between">
          <CardHeader
            title="Today"
            subtitle="Revenue and volume since midnight."
            action={
              <Link
                to="/admin/orders"
                className="text-sm font-medium text-brand-red transition-colors duration-150 hover:text-brand-redDark"
              >
                View orders →
              </Link>
            }
          />
          <div className="mt-6 flex flex-wrap items-end gap-x-12 gap-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-admin-subtle">
                Revenue today
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-admin-ink">
                {data ? GHS(data.revenue.today) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-admin-subtle">
                Orders today
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-admin-ink">
                {data?.orders.today ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-admin-subtle">
                In the kitchen
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-brand-red">
                {data ? active : '—'}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid gap-4 border-t border-admin-line pt-5 sm:grid-cols-3">
            {[
              ['Delivered', data?.orders.byStatus.delivered ?? 0],
              ['Cancelled', data?.orders.byStatus.cancelled ?? 0],
              ['Total orders', data?.orders.total ?? 0],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase tracking-wider text-admin-subtle">
                  {label}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-admin-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <StatTile
            label="All-time revenue"
            value={data ? GHS(data.revenue.total) : '—'}
            icon="₵"
            tint="green"
          />
          <StatTile
            label="Avg order value"
            value={data ? GHS(data.revenue.avgOrderValue) : '—'}
            icon="◎"
            tint="blue"
          />
          <StatTile label="Awaiting action" value={active} icon="!" tint="amber" />
        </div>
      </div>

      <Card className="mt-5" padded={false}>
        <div className="px-6 pb-4 pt-6">
          <CardHeader
            title="Recent orders"
            subtitle="The last ten, updating live."
            action={
              <Link
                to="/admin/orders"
                className="text-sm font-medium text-brand-red transition-colors duration-150 hover:text-brand-redDark"
              >
                View all →
              </Link>
            }
          />
        </div>
        <DataTable
          columns={COLUMNS}
          rows={data?.recent ?? []}
          rowKey={(o) => o._id}
          empty="No orders yet."
        />
      </Card>
    </div>
  );
}
