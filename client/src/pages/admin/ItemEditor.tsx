import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../lib/api';
import type {
  Category,
  MenuItem,
  ModifierGroup,
  ModifierGroupTemplate,
  ModifierOption,
  Variant,
} from '../../lib/types';
import { GHS } from '../../lib/format';
import { invalidateCatalogue } from '../../lib/useCatalogue';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../../components/admin/ui';

/** Client-side placeholder id. The server mints the real one on save. */
const tempId = () => `new-${Math.random().toString(36).slice(2, 10)}`;

interface Draft {
  name: string;
  description: string;
  category: string;
  /** Empty string = unpriced, which the storefront renders as "coming soon". */
  basePrice: string;
  preparationTime: string;
  isAvailable: boolean;
  isPopular: boolean;
  isNew: boolean;
  imageUrl: string;
  variants: Variant[];
  modifierGroups: ModifierGroup[];
  addOnItems: string[];
}

const EMPTY: Draft = {
  name: '',
  description: '',
  category: '',
  basePrice: '',
  preparationTime: '15',
  isAvailable: true,
  isPopular: false,
  isNew: false,
  imageUrl: '',
  variants: [],
  modifierGroups: [],
  addOnItems: [],
};

/**
 * The item editor.
 *
 * Everything that makes an item configurable is edited here, inline: size
 * tiers, modifier groups and their options, and links to other sellable items
 * as add-ons. Saving writes the whole shape in one PATCH, and the storefront
 * reflects it on the next load without a code change.
 */
export default function ItemEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<ModifierGroupTemplate[]>([]);
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const patch = useCallback((changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes })), []);

  useEffect(() => {
    api.get<Category[]>('/categories').then((r) => setCategories(r.data)).catch(() => {});
    api
      .get<ModifierGroupTemplate[]>('/admin/modifier-templates')
      .then((r) => setTemplates(r.data))
      .catch(() => {});
    api.get<MenuItem[]>('/admin/menu').then((r) => setAllItems(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    api
      .get<MenuItem>(`/admin/menu/${id}`)
      .then(({ data }) => {
        setDraft({
          name: data.name,
          description: data.description ?? '',
          category: typeof data.category === 'string' ? data.category : data.category._id,
          basePrice: data.basePrice == null ? '' : String(data.basePrice),
          preparationTime: String(data.preparationTime ?? 15),
          isAvailable: data.isAvailable,
          isPopular: data.isPopular,
          isNew: data.isNew,
          imageUrl: data.image?.url ?? '',
          variants: data.variants ?? [],
          modifierGroups: data.modifierGroups ?? [],
          addOnItems: (data.addOnItems ?? []).map((a) =>
            typeof a === 'string' ? a : a._id
          ),
        });
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Default the category once the list arrives, for a brand-new item.
  useEffect(() => {
    if (isNew && !draft.category && categories.length) patch({ category: categories[0]._id });
  }, [isNew, draft.category, categories, patch]);

  /* ---------- Variants ---------- */

  const setVariant = (index: number, changes: Partial<Variant>) =>
    patch({
      variants: draft.variants.map((v, i) =>
        i === index
          ? { ...v, ...changes }
          : // Only one default is meaningful, so setting one clears the rest.
            changes.isDefault
            ? { ...v, isDefault: false }
            : v
      ),
    });

  /* ---------- Modifier groups ---------- */

  const setGroup = (index: number, changes: Partial<ModifierGroup>) =>
    patch({
      modifierGroups: draft.modifierGroups.map((g, i) =>
        i === index
          ? // Editing an attached template's copy detaches it: the item now owns
            // its own version and will not be overwritten by a later sync.
            { ...g, ...changes, overridden: g.templateId ? true : g.overridden }
          : g
      ),
    });

  const setOption = (gi: number, oi: number, changes: Partial<ModifierOption>) =>
    setGroup(gi, {
      options: draft.modifierGroups[gi].options.map((o, i) =>
        i === oi ? { ...o, ...changes } : o
      ),
    });

  const addGroup = () =>
    patch({
      modifierGroups: [
        ...draft.modifierGroups,
        {
          id: tempId(),
          name: '',
          type: 'single',
          required: false,
          minSelect: 0,
          maxSelect: 0,
          templateId: null,
          overridden: false,
          options: [{ id: tempId(), name: '', priceDelta: 0, available: true }],
        },
      ],
    });

  const attachTemplate = (templateId: string) => {
    const template = templates.find((t) => t._id === templateId);
    if (!template) return;
    if (draft.modifierGroups.some((g) => g.templateId === templateId)) {
      setError(`"${template.name}" is already on this item.`);
      return;
    }
    setError('');
    patch({
      modifierGroups: [
        ...draft.modifierGroups,
        {
          id: tempId(),
          name: template.name,
          type: template.type,
          required: template.required,
          minSelect: template.minSelect,
          maxSelect: template.maxSelect,
          templateId: template._id,
          overridden: false,
          // Fresh ids: the item's copy is independent of the template's.
          options: template.options.map((o) => ({ ...o, id: tempId() })),
        },
      ],
    });
  };

  /* ---------- Save ---------- */

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      basePrice: draft.basePrice === '' ? null : Number(draft.basePrice),
      preparationTime: Number(draft.preparationTime) || 15,
      isAvailable: draft.isAvailable,
      isPopular: draft.isPopular,
      isNew: draft.isNew,
      imageUrl: draft.imageUrl.trim(),
      // Placeholder ids are stripped so the server mints real, stable ones.
      variants: draft.variants.map(({ id: vid, ...rest }) => ({
        ...(vid.startsWith('new-') ? {} : { id: vid }),
        ...rest,
      })),
      modifierGroups: draft.modifierGroups.map(({ id: gid, options, ...rest }) => ({
        ...(gid.startsWith('new-') ? {} : { id: gid }),
        ...rest,
        options: options.map(({ id: oid, ...opt }) => ({
          ...(oid.startsWith('new-') ? {} : { id: oid }),
          ...opt,
        })),
      })),
      addOnItems: draft.addOnItems,
    };
    try {
      if (isNew) await api.post('/admin/menu', payload);
      else await api.patch(`/admin/menu/${id}`, payload);
      invalidateCatalogue();
      navigate('/admin/menu');
    } catch (err) {
      setError(apiError(err, 'Could not save this item.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-admin-muted">Loading…</p>;
  }

  const linkableItems = allItems.filter((i) => i._id !== id);

  return (
    <form onSubmit={save}>
      <PageHeader
        title={isNew ? 'New item' : draft.name || 'Edit item'}
        subtitle="Sizes, modifier groups and add-ons all take effect on the storefront immediately."
        action={
          <div className="flex gap-2">
            <Button type="button" onClick={() => navigate('/admin/menu')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save item'}
            </Button>
          </div>
        }
      />

      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {/* ── Basics */}
          <Card>
            <CardHeader title="Basics" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2">
                <Input
                  required
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <Select
                  required
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Base price (GH₵)"
                hint="Leave empty while the price is undecided — the item shows as coming soon."
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.basePrice}
                  onChange={(e) => patch({ basePrice: e.target.value })}
                />
              </Field>
              <Field label="Prep time (min)">
                <Input
                  type="number"
                  min="1"
                  value={draft.preparationTime}
                  onChange={(e) => patch({ preparationTime: e.target.value })}
                />
              </Field>
              <Field label="Image URL" hint="Blank uses the category photograph.">
                <Input
                  value={draft.imageUrl}
                  onChange={(e) => patch({ imageUrl: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-5 border-t border-admin-line pt-5">
              <Checkbox
                label="Available"
                checked={draft.isAvailable}
                onChange={(v) => patch({ isAvailable: v })}
              />
              <Checkbox
                label="Popular"
                checked={draft.isPopular}
                onChange={(v) => patch({ isPopular: v })}
              />
              <Checkbox label="New" checked={draft.isNew} onChange={(v) => patch({ isNew: v })} />
            </div>
          </Card>

          {/* ── Sizes */}
          <Card>
            <CardHeader
              title="Sizes"
              subtitle="Each is a delta on the base price. No sizes means one flat price."
              action={
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    patch({
                      variants: [
                        ...draft.variants,
                        {
                          id: tempId(),
                          name: '',
                          priceDelta: 0,
                          isDefault: draft.variants.length === 0,
                        },
                      ],
                    })
                  }
                >
                  + Add size
                </Button>
              }
            />
            {draft.variants.length === 0 ? (
              <p className="mt-4 text-sm text-admin-muted">This item has a single size.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {draft.variants.map((v, i) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Size name"
                      value={v.name}
                      onChange={(e) => setVariant(i, { name: e.target.value })}
                      className="min-w-[10rem] flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={v.priceDelta}
                      onChange={(e) => setVariant(i, { priceDelta: Number(e.target.value) })}
                      className="w-28"
                      aria-label="Price delta"
                    />
                    <span className="w-24 text-right text-xs tabular-nums text-admin-subtle">
                      {draft.basePrice === ''
                        ? '—'
                        : GHS(Number(draft.basePrice) + v.priceDelta)}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-admin-muted">
                      <input
                        type="radio"
                        name="default-variant"
                        checked={v.isDefault}
                        onChange={() => setVariant(i, { isDefault: true })}
                        className="h-3.5 w-3.5 accent-brand-red"
                      />
                      Default
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patch({ variants: draft.variants.filter((_, x) => x !== i) })
                      }
                      aria-label={`Remove ${v.name || 'size'}`}
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ── Modifier groups */}
          <Card>
            <CardHeader
              title="Modifier groups"
              subtitle="Crust, spice level, extra toppings — anything the customer chooses."
              action={
                <div className="flex gap-2">
                  <Select
                    aria-label="Attach a reusable group"
                    value=""
                    onChange={(e) => e.target.value && attachTemplate(e.target.value)}
                    className="h-8 w-44 py-0 text-xs"
                  >
                    <option value="">Attach from library…</option>
                    {templates.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" size="sm" onClick={addGroup}>
                    + New group
                  </Button>
                </div>
              }
            />

            {draft.modifierGroups.length === 0 ? (
              <p className="mt-4 text-sm text-admin-muted">
                No groups. The item is added to the cart in one tap.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {draft.modifierGroups.map((group, gi) => (
                  <fieldset key={group.id} className="rounded-xl border border-admin-line p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Group name" className="min-w-[12rem] flex-1">
                        <Input
                          value={group.name}
                          onChange={(e) => setGroup(gi, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Type">
                        <Select
                          value={group.type}
                          onChange={(e) =>
                            setGroup(gi, { type: e.target.value as ModifierGroup['type'] })
                          }
                          className="w-32"
                        >
                          <option value="single">Single</option>
                          <option value="multi">Multi</option>
                        </Select>
                      </Field>
                      <Field label="Min">
                        <Input
                          type="number"
                          min="0"
                          value={group.minSelect}
                          onChange={(e) => setGroup(gi, { minSelect: Number(e.target.value) })}
                          className="w-20"
                        />
                      </Field>
                      <Field label="Max" hint="0 = no limit">
                        <Input
                          type="number"
                          min="0"
                          value={group.maxSelect}
                          onChange={(e) => setGroup(gi, { maxSelect: Number(e.target.value) })}
                          className="w-20"
                        />
                      </Field>
                      <div className="pb-2.5">
                        <Checkbox
                          label="Required"
                          checked={group.required}
                          onChange={(v) => setGroup(gi, { required: v })}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mb-1"
                        onClick={() =>
                          patch({
                            modifierGroups: draft.modifierGroups.filter((_, x) => x !== gi),
                          })
                        }
                      >
                        Remove group
                      </Button>
                    </div>

                    {group.templateId && (
                      <p className="mt-2 text-xs text-admin-subtle">
                        {group.overridden
                          ? 'Detached from the library copy — library updates no longer apply.'
                          : 'Linked to the modifier library. Editing it here detaches this copy.'}
                      </p>
                    )}

                    <ul className="mt-4 space-y-2">
                      {group.options.map((option, oi) => (
                        <li key={option.id} className="flex flex-wrap items-center gap-2">
                          <Input
                            placeholder="Option name"
                            value={option.name}
                            onChange={(e) => setOption(gi, oi, { name: e.target.value })}
                            className="min-w-[10rem] flex-1"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={option.priceDelta}
                            onChange={(e) =>
                              setOption(gi, oi, { priceDelta: Number(e.target.value) })
                            }
                            className="w-28"
                            aria-label="Price delta"
                          />
                          <Checkbox
                            label="Available"
                            checked={option.available}
                            onChange={(v) => setOption(gi, oi, { available: v })}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setGroup(gi, {
                                options: group.options.filter((_, x) => x !== oi),
                              })
                            }
                            aria-label={`Remove ${option.name || 'option'}`}
                          >
                            ✕
                          </Button>
                        </li>
                      ))}
                    </ul>

                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        setGroup(gi, {
                          options: [
                            ...group.options,
                            { id: tempId(), name: '', priceDelta: 0, available: true },
                          ],
                        })
                      }
                    >
                      + Add option
                    </Button>
                  </fieldset>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Add-on links */}
        <div>
          <Card>
            <CardHeader
              title="Add-ons"
              subtitle="Real products offered alongside this one, in the configurator and at checkout."
            />
            <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
              {linkableItems.map((candidate) => {
                const checked = draft.addOnItems.includes(candidate._id);
                return (
                  <li key={candidate._id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-admin-bg">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          patch({
                            addOnItems: e.target.checked
                              ? [...draft.addOnItems, candidate._id]
                              : draft.addOnItems.filter((x) => x !== candidate._id),
                          })
                        }
                        className="h-4 w-4 accent-brand-red"
                      />
                      <span className="min-w-0 flex-1 truncate text-admin-ink">
                        {candidate.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-admin-subtle">
                        {candidate.basePrice == null ? '—' : GHS(candidate.basePrice)}
                      </span>
                    </label>
                  </li>
                );
              })}
              {linkableItems.length === 0 && (
                <li className="px-2 py-4 text-sm text-admin-muted">
                  Nothing else in the catalogue yet.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </form>
  );
}
