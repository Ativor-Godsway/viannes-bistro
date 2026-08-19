import { useCallback, useEffect, useState } from 'react';
import { api, apiError } from '../../lib/api';
import type { Category, MenuItem } from '../../lib/types';
import { invalidateCatalogue } from '../../lib/useCatalogue';
import { Button, Card, Field, Input, Modal, PageHeader } from '../../components/admin/ui';

interface Draft {
  _id?: string;
  name: string;
  description: string;
  icon: string;
}

const EMPTY: Draft = { name: '', description: '', icon: '' };

/**
 * Category manager.
 *
 * Drag a row to change the order the storefront shows categories in. Deleting
 * is refused while a category still holds items — the server enforces that, so
 * there is no path where products are quietly orphaned.
 */
export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<Category[]>('/categories')
      .then((r) => setCategories(r.data))
      .catch((e) => setError(apiError(e)));
    api
      .get<MenuItem[]>('/admin/menu')
      .then((r) => {
        const next: Record<string, number> = {};
        for (const item of r.data) {
          const id = typeof item.category === 'string' ? item.category : item.category?._id;
          if (id) next[id] = (next[id] ?? 0) + 1;
        }
        setCounts(next);
      })
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      icon: draft.icon.trim(),
    };
    try {
      if (draft._id) await api.patch(`/admin/categories/${draft._id}`, payload);
      else await api.post('/admin/categories', payload);
      setDraft(null);
      invalidateCatalogue();
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    if (!confirm(`Delete "${category.name}"?`)) return;
    try {
      await api.delete(`/admin/categories/${category._id}`);
      invalidateCatalogue();
      load();
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const next = [...categories];
    const from = next.findIndex((c) => c._id === dragging);
    const to = next.findIndex((c) => c._id === targetId);
    if (from === -1 || to === -1) return;
    next.splice(to, 0, ...next.splice(from, 1));
    setCategories(next);
    setDragging(null);
    try {
      await api.patch('/admin/categories/reorder', { order: next.map((c) => c._id) });
      invalidateCatalogue();
    } catch (e) {
      setError(apiError(e));
      load();
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Drag to set the order the storefront lists them in."
        action={
          <Button variant="primary" onClick={() => setDraft({ ...EMPTY })}>
            + New category
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      <Card padded={false}>
        <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.5fr)_6rem_10rem] gap-3 border-b border-admin-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-admin-subtle sm:grid">
          <span />
          <span>Name</span>
          <span>Description</span>
          <span className="text-right">Items</span>
          <span className="text-right">Actions</span>
        </div>

        {categories.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-admin-muted">No categories yet.</p>
        ) : (
          <ul>
            {categories.map((c) => (
              <li
                key={c._id}
                draggable
                onDragStart={() => setDragging(c._id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(c._id)}
                onDragEnd={() => setDragging(null)}
                className={`grid grid-cols-1 gap-3 border-b border-admin-line/70 px-5 py-4 text-sm transition-colors duration-150 last:border-0 hover:bg-admin-bg sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.5fr)_6rem_10rem] sm:items-center ${
                  dragging === c._id ? 'opacity-50' : ''
                }`}
              >
                <span
                  aria-hidden
                  className="hidden cursor-grab select-none text-center text-admin-subtle active:cursor-grabbing sm:block"
                >
                  ⋮⋮
                </span>
                <span className="font-medium text-admin-ink">
                  {c.icon && <span className="mr-2">{c.icon}</span>}
                  {c.name}
                </span>
                <span className="truncate text-admin-muted">{c.description || '—'}</span>
                <span className="tabular-nums text-admin-muted sm:text-right">
                  {counts[c._id] ?? 0}
                </span>
                <span className="flex gap-2 sm:justify-end">
                  <Button
                    size="sm"
                    onClick={() =>
                      setDraft({
                        _id: c._id,
                        name: c.name,
                        description: c.description ?? '',
                        icon: c.icon ?? '',
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={(counts[c._id] ?? 0) > 0}
                    title={
                      counts[c._id] ? 'Move or delete its items first' : undefined
                    }
                    onClick={() => remove(c)}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?._id ? 'Edit category' : 'New category'}
        footer={
          <>
            <Button type="button" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {draft && (
          <form id="category-form" onSubmit={save} className="space-y-4">
            <Field label="Name">
              <Input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field
              label="Icon"
              hint="An emoji, used where there is no photograph for the category."
            >
              <Input
                value={draft.icon}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
