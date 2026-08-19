import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '../../lib/api';
import type { Category, MenuItem } from '../../lib/types';
import { GHS } from '../../lib/format';
import { priceRange } from '../../lib/pricing';
import { invalidateCatalogue } from '../../lib/useCatalogue';
import { Button, Card, Input, PageHeader, Select, StatusPill } from '../../components/admin/ui';

/**
 * The catalogue list.
 *
 * Rows are drag-to-sort and the order persists as `sortOrder`, which the
 * storefront honours. Availability is a one-click toggle rather than an edit —
 * 86ing an item during service should not mean opening a form.
 */
export default function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get<MenuItem[]>('/admin/menu')
      .then((r) => setItems(r.data))
      .catch((e) => setError(apiError(e)));
    api
      .get<Category[]>('/categories')
      .then((r) => setCategories(r.data))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function toggleAvailable(item: MenuItem) {
    setError('');
    // Optimistic: the toggle is used mid-service and must feel instant.
    setItems((prev) =>
      prev.map((i) => (i._id === item._id ? { ...i, isAvailable: !i.isAvailable } : i))
    );
    try {
      await api.patch(`/admin/menu/${item._id}/availability`, { isAvailable: !item.isAvailable });
      invalidateCatalogue();
    } catch (e) {
      setError(apiError(e));
      load();
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/menu/${item._id}`);
      invalidateCatalogue();
      load();
    } catch (e) {
      setError(apiError(e));
    }
  }

  /** Reorders locally, then persists the whole visible order in one call. */
  async function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const next = [...items];
    const from = next.findIndex((i) => i._id === dragging);
    const to = next.findIndex((i) => i._id === targetId);
    if (from === -1 || to === -1) return;
    next.splice(to, 0, ...next.splice(from, 1));
    setItems(next);
    setDragging(null);
    try {
      await api.patch('/admin/menu/reorder', { order: next.map((i) => i._id) });
      invalidateCatalogue();
    } catch (e) {
      setError(apiError(e));
      load();
    }
  }

  const visible = items.filter((item) => {
    const categoryId = typeof item.category === 'string' ? item.category : item.category?._id;
    if (filter !== 'all' && categoryId !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || item.name.toLowerCase().includes(q);
  });

  const configSummary = (item: MenuItem) => {
    const bits = [];
    if (item.variants?.length) bits.push(`${item.variants.length} sizes`);
    if (item.modifierGroups?.length) bits.push(`${item.modifierGroups.length} groups`);
    if (item.addOnItems?.length) bits.push(`${item.addOnItems.length} add-ons`);
    return bits.length ? bits.join(' · ') : 'No options';
  };

  return (
    <div>
      <PageHeader
        title="Menu items"
        subtitle={`${items.length} items · drag a row to reorder the storefront`}
        action={
          <Button variant="primary" onClick={() => navigate('/admin/menu/new')}>
            + New item
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items"
          className="sm:max-w-xs"
        />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:max-w-[14rem]">
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      <Card padded={false}>
        <div className="hidden grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_8rem_7rem_10rem] gap-3 border-b border-admin-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-admin-subtle lg:grid">
          <span />
          <span>Item</span>
          <span>Category</span>
          <span>Options</span>
          <span className="text-right">Price</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-admin-muted">No items match.</p>
        ) : (
          <ul>
            {visible.map((item) => {
              const range = priceRange(item);
              return (
                <li
                  key={item._id}
                  draggable
                  onDragStart={() => setDragging(item._id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(item._id)}
                  onDragEnd={() => setDragging(null)}
                  className={`grid grid-cols-1 gap-3 border-b border-admin-line/70 px-5 py-4 text-sm transition-colors duration-150 last:border-0 hover:bg-admin-bg lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_8rem_7rem_10rem] lg:items-center ${
                    dragging === item._id ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className="hidden cursor-grab select-none text-center text-admin-subtle active:cursor-grabbing lg:block"
                  >
                    ⋮⋮
                  </span>

                  <Link
                    to={`/admin/menu/${item._id}`}
                    className="min-w-0 font-medium text-admin-ink transition-colors duration-150 hover:text-brand-red"
                  >
                    <span className="block truncate">{item.name}</span>
                    <span className="block truncate text-xs font-normal text-admin-subtle">
                      {item.description || '—'}
                    </span>
                  </Link>

                  <span className="truncate text-admin-muted">
                    {typeof item.category === 'string' ? '—' : item.category?.name}
                  </span>

                  <span className="truncate text-admin-muted">{configSummary(item)}</span>

                  <span className="tabular-nums text-admin-ink lg:text-right">
                    {range
                      ? range.min === range.max
                        ? GHS(range.min)
                        : `${GHS(range.min)} – ${GHS(range.max)}`
                      : <span className="text-admin-subtle">Unpriced</span>}
                  </span>

                  <span>
                    <StatusPill
                      status={item.isAvailable ? 'available' : 'hidden'}
                      label={item.isAvailable ? 'Available' : 'Hidden'}
                    />
                  </span>

                  <span className="flex gap-2 lg:justify-end">
                    <Button size="sm" onClick={() => toggleAvailable(item)}>
                      {item.isAvailable ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => remove(item)}>
                      Delete
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
