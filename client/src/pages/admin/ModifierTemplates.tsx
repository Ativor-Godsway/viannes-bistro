import { useCallback, useEffect, useState } from 'react';
import { api, apiError } from '../../lib/api';
import type { ModifierGroupTemplate, ModifierOption } from '../../lib/types';
import { GHS } from '../../lib/format';
import { invalidateCatalogue } from '../../lib/useCatalogue';
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
} from '../../components/admin/ui';

const tempId = () => `new-${Math.random().toString(36).slice(2, 10)}`;

interface Draft {
  _id?: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

const EMPTY: Draft = {
  name: '',
  type: 'single',
  required: false,
  minSelect: 0,
  maxSelect: 0,
  options: [{ id: tempId(), name: '', priceDelta: 0, available: true }],
};

/**
 * The reusable modifier library.
 *
 * Define "Drinks add-on" once here and attach it to as many items as you like
 * from the item editor. Attaching copies the shape and records the link, so an
 * item keeps working if the template is deleted; "Push to items" refreshes
 * every attached copy that hasn't been edited locally.
 */
export default function ModifierTemplates() {
  const [templates, setTemplates] = useState<ModifierGroupTemplate[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<ModifierGroupTemplate[]>('/admin/modifier-templates')
      .then((r) => setTemplates(r.data))
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(load, [load]);

  const setOption = (index: number, changes: Partial<ModifierOption>) =>
    setDraft((d) =>
      d
        ? { ...d, options: d.options.map((o, i) => (i === index ? { ...o, ...changes } : o)) }
        : d
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');
    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      required: draft.required,
      minSelect: draft.minSelect,
      maxSelect: draft.maxSelect,
      options: draft.options.map(({ id, ...rest }) => ({
        ...(id.startsWith('new-') ? {} : { id }),
        ...rest,
      })),
    };
    try {
      if (draft._id) await api.patch(`/admin/modifier-templates/${draft._id}`, payload);
      else await api.post('/admin/modifier-templates', payload);
      setDraft(null);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(template: ModifierGroupTemplate) {
    if (
      !confirm(
        `Delete "${template.name}"? Items already using it keep their copy, but stop tracking this template.`
      )
    )
      return;
    try {
      await api.delete(`/admin/modifier-templates/${template._id}`);
      invalidateCatalogue();
      load();
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function sync(template: ModifierGroupTemplate) {
    setError('');
    try {
      const { data } = await api.post<{ updated: number }>(
        `/admin/modifier-templates/${template._id}/sync`
      );
      invalidateCatalogue();
      setNotice(
        `Pushed "${template.name}" to ${data.updated} item${data.updated === 1 ? '' : 's'}.`
      );
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <div>
      <PageHeader
        title="Modifier library"
        subtitle="Reusable option groups. Define once, attach to many items."
        action={
          <Button variant="primary" onClick={() => setDraft({ ...EMPTY })}>
            + New group
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t._id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight text-admin-ink">
                  {t.name}
                </h2>
                <p className="mt-0.5 text-xs text-admin-muted">
                  {t.type === 'single' ? 'Choose one' : 'Choose several'}
                  {t.required ? ' · required' : ' · optional'}
                  {t.maxSelect ? ` · max ${t.maxSelect}` : ''}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-admin-bg px-2 py-1 text-xs font-medium text-admin-muted">
                {t.usageCount ?? 0} item{(t.usageCount ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            <ul className="mt-4 flex-1 space-y-1 text-sm">
              {t.options.map((o) => (
                <li key={o.id} className="flex justify-between gap-3 text-admin-muted">
                  <span className={`truncate ${o.available ? '' : 'line-through opacity-60'}`}>
                    {o.name}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {o.priceDelta ? `+${GHS(o.priceDelta)}` : 'Free'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-admin-line pt-4">
              <Button
                size="sm"
                onClick={() =>
                  setDraft({
                    _id: t._id,
                    name: t.name,
                    type: t.type,
                    required: t.required,
                    minSelect: t.minSelect,
                    maxSelect: t.maxSelect,
                    options: t.options,
                  })
                }
              >
                Edit
              </Button>
              <Button size="sm" onClick={() => sync(t)}>
                Push to items
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(t)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}

        {templates.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <p className="py-8 text-center text-sm text-admin-muted">
              No reusable groups yet. Create one and it becomes attachable from any item.
            </p>
          </Card>
        )}
      </div>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?._id ? 'Edit group' : 'New group'}
        footer={
          <>
            <Button type="button" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="submit" form="template-form" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {draft && (
          <form id="template-form" onSubmit={save} className="space-y-4">
            <Field label="Name">
              <Input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Type">
                <Select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft['type'] })}
                >
                  <option value="single">Single</option>
                  <option value="multi">Multi</option>
                </Select>
              </Field>
              <Field label="Min">
                <Input
                  type="number"
                  min="0"
                  value={draft.minSelect}
                  onChange={(e) => setDraft({ ...draft, minSelect: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max" hint="0 = no limit">
                <Input
                  type="number"
                  min="0"
                  value={draft.maxSelect}
                  onChange={(e) => setDraft({ ...draft, maxSelect: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Checkbox
              label="Required"
              checked={draft.required}
              onChange={(v) => setDraft({ ...draft, required: v })}
            />

            <div className="border-t border-admin-line pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-admin-muted">
                Options
              </p>
              <ul className="space-y-2">
                {draft.options.map((option, i) => (
                  <li key={option.id} className="flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Option name"
                      value={option.name}
                      onChange={(e) => setOption(i, { name: e.target.value })}
                      className="min-w-[9rem] flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={option.priceDelta}
                      onChange={(e) => setOption(i, { priceDelta: Number(e.target.value) })}
                      className="w-24"
                      aria-label="Price delta"
                    />
                    <Checkbox
                      label="Available"
                      checked={option.available}
                      onChange={(v) => setOption(i, { available: v })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({ ...draft, options: draft.options.filter((_, x) => x !== i) })
                      }
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
                  setDraft({
                    ...draft,
                    options: [
                      ...draft.options,
                      { id: tempId(), name: '', priceDelta: 0, available: true },
                    ],
                  })
                }
              >
                + Add option
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
