import { forwardRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { STATUS_LABEL } from '../../lib/format';

/**
 * Admin primitives.
 *
 * The admin is a formal tool: one sans family, a tight scale, muted grays for
 * secondary text, near-black for primary, and the Besties red reserved for
 * primary actions, active states and destructive ones. No gradients, no text
 * shadows, and no transition longer than 150ms anywhere in here.
 */

/* ---------- Card ---------- */

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl bg-admin-surface shadow-card ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-admin-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-admin-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- StatTile ---------- */

export function StatTile({
  label,
  value,
  icon,
  tint = 'red',
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tint?: 'red' | 'green' | 'blue' | 'amber';
}) {
  const tints: Record<string, string> = {
    red: 'bg-brand-red/10 text-brand-red',
    green: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-sky-500/10 text-sky-600',
    amber: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <div className="rounded-2xl bg-admin-surface p-5 shadow-card">
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl text-base ${tints[tint]}`}
        aria-hidden
      >
        {icon}
      </span>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-admin-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-admin-ink">
        {value}
      </p>
    </div>
  );
}

/* ---------- Button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

const BUTTON_VARIANTS: Record<string, string> = {
  primary: 'bg-brand-red text-white hover:bg-brand-redDark',
  secondary: 'bg-white text-admin-ink ring-1 ring-admin-line hover:bg-admin-bg',
  ghost: 'text-admin-muted hover:bg-admin-bg hover:text-admin-ink',
  danger: 'text-brand-red ring-1 ring-brand-red/25 hover:bg-brand-red/5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className = '', ...props },
  ref
) {
  const sizes = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';
  return (
    <button
      ref={ref}
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
});

/* ---------- Form fields ---------- */

const FIELD =
  'w-full rounded-xl border border-admin-line bg-white px-3.5 py-2.5 text-sm text-admin-ink placeholder:text-admin-subtle outline-none transition-colors duration-150 focus:border-brand-red disabled:bg-admin-bg disabled:text-admin-muted';

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-admin-muted">
          {label}
        </span>
      )}
      {children}
      {(error || hint) && (
        <span className={`mt-1 block text-xs ${error ? 'text-brand-red' : 'text-admin-subtle'}`}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} {...props} className={`${FIELD} ${className}`} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} {...props} className={`${FIELD} resize-y ${className}`} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...props }, ref) {
    return <select ref={ref} {...props} className={`${FIELD} ${className}`} />;
  }
);

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-admin-ink">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-red"
      />
      {label}
    </label>
  );
}

/* ---------- StatusPill ---------- */

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
  preparing: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  ready: 'bg-violet-50 text-violet-700 ring-violet-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 ring-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  hidden: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_TONE[status] ?? STATUS_TONE.hidden
      }`}
    >
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

/* ---------- DataTable ---------- */

export interface Column<T> {
  key: string;
  header: string;
  /** Right-aligns the column — use it for every numeric. */
  numeric?: boolean;
  /** Hides the column below `sm`, for secondary detail on narrow screens. */
  secondary?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'Nothing here yet.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-12 text-center text-sm text-admin-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-admin-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-admin-subtle ${
                  c.numeric ? 'text-right' : 'text-left'
                } ${c.secondary ? 'hidden sm:table-cell' : ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-admin-line/70 last:border-0 transition-colors duration-150 ${
                onRowClick ? 'cursor-pointer hover:bg-admin-bg' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-5 py-4 align-middle text-admin-ink ${
                    c.numeric ? 'text-right tabular-nums' : 'text-left'
                  } ${c.secondary ? 'hidden sm:table-cell' : ''}`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-admin-ink/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-admin-surface shadow-cardHover ${
              wide ? 'max-w-3xl' : 'max-w-lg'
            }`}
          >
            <header className="flex items-center justify-between border-b border-admin-line px-6 py-4">
              <h2 className="text-base font-semibold tracking-tight text-admin-ink">{title}</h2>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
                ✕
              </Button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <footer className="flex justify-end gap-2 border-t border-admin-line px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-admin-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-admin-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
