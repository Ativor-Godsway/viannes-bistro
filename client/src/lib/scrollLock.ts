/**
 * Body scroll lock that preserves the page's scroll position exactly.
 *
 * `overflow: hidden` alone is not enough: on iOS Safari the page jumps to the
 * top when the body stops scrolling, so closing a configurator would dump the
 * customer back at the hero instead of the card they tapped. Pinning the body
 * with `position: fixed` at a negative offset holds the rendered position, and
 * unlocking restores the exact scrollY.
 *
 * Locks are reference-counted: the cart drawer can open over the configurator
 * and the first one to close must not unlock the page underneath the second.
 */
let depth = 0;
let savedY = 0;
let saved: { overflow: string; position: string; top: string; width: string } | null = null;

export function lockScroll(): void {
  depth += 1;
  if (depth > 1) return;

  savedY = window.scrollY;
  const { style } = document.body;
  saved = {
    overflow: style.overflow,
    position: style.position,
    top: style.top,
    width: style.width,
  };
  style.overflow = 'hidden';
  style.position = 'fixed';
  style.top = `-${savedY}px`;
  // Fixed positioning collapses the body to its content width; without this the
  // page visibly narrows the moment a modal opens.
  style.width = '100%';
}

export function unlockScroll(): void {
  depth = Math.max(0, depth - 1);
  if (depth > 0 || !saved) return;

  const { style } = document.body;
  style.overflow = saved.overflow;
  style.position = saved.position;
  style.top = saved.top;
  style.width = saved.width;
  saved = null;

  // 'instant' so the restore is invisible — a smooth scroll here reads as the
  // page lurching after the modal has already gone.
  window.scrollTo({ top: savedY, left: 0, behavior: 'instant' as ScrollBehavior });
}

/** Convenience for `useEffect`: lock on mount, unlock on cleanup. */
export function withScrollLock(): () => void {
  lockScroll();
  return unlockScroll;
}
