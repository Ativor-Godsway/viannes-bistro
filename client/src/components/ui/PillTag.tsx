/**
 * A small outline pill used as a floating label — the corner tags on the
 * statement band, the STEP 1/2/3 markers on the three-step strip.
 *
 * Not interactive. If it needs to be pressed it is a PillButton instead.
 */
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** `onDark` for the deep-red bands, where brown has no contrast. */
  tone?: 'onCream' | 'onDark';
  className?: string;
}

export default function PillTag({ children, tone = 'onCream', className = '' }: Props) {
  const toneClass =
    tone === 'onDark'
      ? 'border-brand-cream/70 text-brand-cream'
      : 'border-brand-brown/50 text-brand-brown';

  return (
    <span
      className={`inline-flex items-center rounded-full border-[1.5px] px-3.5 py-1.5 font-display text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}
