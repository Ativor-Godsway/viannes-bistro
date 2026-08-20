/**
 * The one button shape in the redesign: fully rounded, uppercase, flat.
 *
 * Two variants and nothing else — solid for the primary action on a surface,
 * outline for everything secondary. No shadows and no gradients: the look is
 * flat and editorial, and elevation is carried by colour blocks instead.
 *
 * Renders as <button>, <a> or a router <Link> depending on the props, because
 * a thing that navigates must be an anchor (cmd-click, middle-click, "open in
 * new tab", and how a screen reader announces it all depend on it).
 */
import { forwardRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type PillVariant = 'solid' | 'outline' | 'onDark';

interface BaseProps {
  variant?: PillVariant;
  children: ReactNode;
  className?: string;
}

// `press` is the shared :active scale — see the motion block in index.css.
// It is a class rather than a Tailwind `active:scale-97` so that the single
// reduced-motion guard in that stylesheet can switch it off in one place.
const BASE =
  'press inline-flex items-center justify-center gap-2 rounded-full font-display text-xs font-semibold uppercase tracking-wide transition-colors duration-150 min-h-[44px] px-6 disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTS: Record<PillVariant, string> = {
  // Cream on brand red: the primary call to action on a cream surface.
  solid: 'bg-brand-red text-brand-cream hover:bg-brand-redDark active:bg-brand-redDark',
  // 2px brown rule, transparent fill, brown text — 7.7:1 on cream.
  outline:
    'border-2 border-brand-brown bg-transparent text-brand-brown hover:bg-brand-brown hover:text-brand-cream',
  // For use on the deep-red bands, where brown would disappear.
  onDark:
    'border-2 border-brand-cream bg-transparent text-brand-cream hover:bg-brand-cream hover:text-brand-redDeep',
};

type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
type AnchorProps = BaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a'; href: string };
type LinkProps = BaseProps & { as: 'link'; to: string; 'aria-label'?: string };

type Props = ButtonProps | AnchorProps | LinkProps;

const PillButton = forwardRef<HTMLElement, Props>(function PillButton(props, ref) {
  const { variant = 'solid', className = '', children } = props;
  const cls = `${BASE} ${VARIANTS[variant]} ${className}`;

  if (props.as === 'link') {
    const { as: _as, variant: _v, className: _c, children: _ch, ...rest } = props;
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  if (props.as === 'a') {
    const { as: _as, variant: _v, className: _c, children: _ch, ...rest } = props;
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={cls} {...rest}>
        {children}
      </a>
    );
  }

  const { as: _as, variant: _v, className: _c, children: _ch, ...rest } = props;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" className={cls} {...rest}>
      {children}
    </button>
  );
});

export default PillButton;
