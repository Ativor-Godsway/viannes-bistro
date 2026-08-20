/**
 * Wraps children in the site's one reveal animation — fade up, once, on scroll.
 *
 * `index` is the position among siblings and is multiplied by the 60ms stagger,
 * so a row of cards is `<Reveal index={i}>` and nothing has to hand-write
 * delays. Keep the stagger short: at four or five siblings a longer one stops
 * reading as one movement and starts reading as a queue.
 *
 * Renders a plain <div> by default. Pass `as` where the wrapper has to be a
 * real element for the surrounding semantics — a <li> inside a list, say —
 * rather than wrapping a <div> around it and breaking the list.
 */
import type { ElementType, ReactNode } from 'react';
import { useReveal } from '../../lib/useReveal';

const STAGGER_MS = 60;

interface Props {
  children: ReactNode;
  /** Position among siblings; multiplied by the 60ms stagger. */
  index?: number;
  /** Extra delay on top of the stagger, in ms. */
  delay?: number;
  as?: ElementType;
  className?: string;
}

export default function Reveal({
  children,
  index = 0,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: Props) {
  const ref = useReveal<HTMLElement>(index * STAGGER_MS + delay);
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
